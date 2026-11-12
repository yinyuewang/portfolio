(function () {
  "use strict";

  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ============================================================
     1. 首屏拼贴：层次 + 拖拽 + 点击置顶
     ============================================================ */
  function initCollage() {
    const cards = $$(".card");
    let topZ = 10;

    cards.forEach((card) => {
      const rot = parseFloat(card.dataset.rotate || 0);
      let tx = 0;
      let ty = 0;

      card.style.setProperty("--rot", rot + "deg");
      card.style.setProperty("--tx", "0px");
      card.style.setProperty("--ty", "0px");

      let dragging = false;
      let moved = false;
      let startX = 0;
      let startY = 0;
      let baseX = 0;
      let baseY = 0;

      const onDown = (e) => {
        const point = e.touches ? e.touches[0] : e;
        dragging = true;
        moved = false;
        startX = point.clientX;
        startY = point.clientY;
        baseX = tx;
        baseY = ty;
        card.style.zIndex = ++topZ;
        card.classList.add("is-dragging");
        e.preventDefault();
      };

      const onMove = (e) => {
        if (!dragging) return;
        const point = e.touches ? e.touches[0] : e;
        const dx = point.clientX - startX;
        const dy = point.clientY - startY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;

        tx = baseX + dx;
        ty = baseY + dy;
        card.style.setProperty("--tx", tx + "px");
        card.style.setProperty("--ty", ty + "px");
        e.preventDefault();
      };

      const onUp = () => {
        if (!dragging) return;
        dragging = false;
        card.classList.remove("is-dragging");
        // 拖拽松手后保持置顶，形成“随意贴”的层次
        if (moved) card.style.zIndex = ++topZ;
      };

      card.addEventListener("mousedown", onDown);
      card.addEventListener("touchstart", onDown, { passive: false });
      document.addEventListener("mousemove", onMove);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchend", onUp);
    });
  }

  /* ============================================================
     2. 弹层开关
     ============================================================ */
  function initModals() {
    const triggers = $$("[data-modal]");
    const modals = $$(".modal");

    const openModal = (id) => {
      const modal = document.getElementById(id);
      if (!modal) return;
      modal.classList.add("open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      if (id === "skillsModal") {
        requestAnimationFrame(() => {
          $$("#skillsModal .skill-fill").forEach((fill) => {
            fill.style.width = fill.dataset.width + "%";
          });
        });
      }
    };

    const closeModal = (modal) => {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      $$("#skillsModal .skill-fill").forEach((fill) => {
        fill.style.width = "0";
      });
    };

    const SKILLS_PASS = "musite666";

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const id = trigger.dataset.modal;
        if (id === "skillsModal") {
          const input = window.prompt("请输入密码");
          if (input === null) return;
          if (input.trim() !== SKILLS_PASS) {
            window.alert("密码不对哦");
            return;
          }
        }
        openModal(id);
      });
    });

    modals.forEach((modal) => {
      $$("[data-close]", modal).forEach((btn) => {
        btn.addEventListener("click", () => closeModal(modal));
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      const open = document.querySelector(".modal.open");
      if (open) closeModal(open);
    });
  }

  /* ============================================================
     3. 时钟：枝桠两臂按真实时间绕轴心转动
     ============================================================ */
  function initClock() {
    const hour = document.querySelector(".hand-hour");
    const minute = document.querySelector(".hand-minute");
    if (!hour || !minute) return;

    // 手臂图里枝桠本身的指向角（从 12 点顺时针），旋转时减去这个偏移
    const HOUR_OFFSET = 307.0;
    const MIN_OFFSET = 56.85;

    const tick = () => {
      const now = new Date();
      const s = now.getSeconds() + now.getMilliseconds() / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;

      hour.style.transform = `rotate(${h * 30 - HOUR_OFFSET}deg)`;
      minute.style.transform = `rotate(${m * 6 - MIN_OFFSET}deg)`;
    };

    tick();
    setInterval(tick, 1000);
  }

  /* ============================================================
     4. 留言本：Supabase 云端共享；没配置时退回本机存储
     ============================================================ */
  function initNotes() {
    /* 填上 Supabase 项目地址和 anon public key 后，所有人的留言就能共享 */
    const CLOUD = {
      url: "https://frmgewdaczkxgcwtysqh.supabase.co",
      key: "sb_publishable_YirNOvGymlQwKeP19y5yng_9hIMH1AP",
    };

    const form = document.getElementById("noteForm");
    const wall = document.getElementById("noteWall");
    const text = document.getElementById("noteText");
    const name = document.getElementById("noteName");
    const empty = document.getElementById("noteEmpty");
    const status = document.getElementById("noteStatus");
    const count = document.getElementById("noteCount");
    const adminBtn = document.getElementById("noteAdminBtn");
    const saveBtn = form ? form.querySelector(".note-save") : null;
    if (!form || !wall || !text) return;

    const PAPERS = ["coffee", "toast", "cake", "mint", "stars"];
    const LOCAL_KEY = "portfolio-notes-v2";
    const PAPER_KEY = "portfolio-note-paper";
    const cloudOn = Boolean(CLOUD.url && CLOUD.key);
    let notes = [];
    let adminPass = "";
    let busy = false;
    let cloudDead = false;

    const headers = (extra) =>
      Object.assign(
        {
          apikey: CLOUD.key,
          Authorization: "Bearer " + CLOUD.key,
          "Content-Type": "application/json",
        },
        extra || {}
      );

    const day = (iso) => {
      const d = iso ? new Date(iso) : new Date();
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString("zh-CN");
    };

    const setStatus = (msg) => {
      if (!status) return;
      status.textContent = msg || "";
      status.hidden = !msg;
    };

    const setBusy = (v) => {
      busy = v;
      if (saveBtn) saveBtn.disabled = v;
    };

    const readLocal = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
        return Array.isArray(saved) ? saved : [];
      } catch (err) {
        return [];
      }
    };

    const writeLocal = () => {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
      } catch (err) {
        /* 隐私模式下写入失败，不影响当前页面展示 */
      }
    };

    const render = () => {
      wall.textContent = "";
      notes.forEach((note) => {
        const paper = PAPERS.indexOf(note.paper) >= 0 ? note.paper : "coffee";

        const card = document.createElement("article");
        card.className = "note-card note-card--" + paper;

        const del = document.createElement("button");
        del.className = "note-del";
        del.type = "button";
        del.dataset.id = note.id;
        del.setAttribute("aria-label", "撕掉这张便签");
        del.textContent = "\u00d7";

        const body = document.createElement("div");
        body.className = "note-card-body";

        const msg = document.createElement("p");
        msg.className = "note-card-text";
        if ((note.text || "").length > 24) msg.classList.add("is-long");
        msg.textContent = note.text || "";

        const meta = document.createElement("p");
        meta.className = "note-card-meta";
        meta.textContent = (note.name ? note.name + " · " : "") + (note.time || "");

        body.append(msg, meta);
        card.append(del, body);
        wall.append(card);
      });
      if (empty) empty.hidden = notes.length > 0;
      if (count) count.textContent = notes.length ? "共 " + notes.length + " 张便签" : "";
    };

    const load = async () => {
      if (!cloudOn) {
        notes = readLocal();
        render();
        setStatus("还没接入云端，现在留言只有这台设备能看见。");
        return;
      }
      setStatus("正在把大家的留言取下来…");
      try {
        const res = await fetch(
          CLOUD.url +
            "/rest/v1/notes?select=id,name,message,paper,created_at&order=created_at.desc&limit=200",
          { headers: headers() }
        );
        if (!res.ok) throw new Error("HTTP " + res.status);
        const rows = await res.json();
        notes = rows.map((row) => ({
          id: row.id,
          name: row.name || "",
          text: row.message || "",
          paper: row.paper || "coffee",
          time: day(row.created_at),
        }));
        writeLocal();
        cloudDead = false;
        setStatus("");
      } catch (err) {
        cloudDead = true;
        notes = readLocal();
        setStatus("云端暂时连不上，留言先存在这台设备上。");
      }
      render();
    };

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      const value = text.value.trim();
      if (!value) {
        text.focus();
        return;
      }
      const checked = form.querySelector('input[name="notePaper"]:checked');
      const paper = checked ? checked.value : "coffee";
      const who = name ? name.value.trim() : "";

      setBusy(true);
      try {
        let savedToCloud = false;
        if (cloudOn && !cloudDead) {
          try {
            const res = await fetch(CLOUD.url + "/rest/v1/notes?select=id,name,message,paper,created_at", {
              method: "POST",
              headers: headers({ Prefer: "return=representation" }),
              body: JSON.stringify({ name: who || null, message: value, paper: paper }),
            });
            if (!res.ok) throw new Error("HTTP " + res.status);
            const rows = await res.json();
            const row = rows[0] || {};
            notes.unshift({
              id: row.id,
              name: row.name || who,
              text: row.message || value,
              paper: row.paper || paper,
              time: day(row.created_at),
            });
            savedToCloud = true;
          } catch (e) {
            cloudDead = true;
          }
        }
        if (!savedToCloud) {
          notes.unshift({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            name: who,
            text: value,
            paper: paper,
            time: day(),
          });
          writeLocal();
        }
        render();
        text.value = "";
        if (name) name.value = "";
        if (cloudDead) {
          setStatus("云端暂时连不上，先存在这台设备上。");
        } else {
          setStatus("贴好啦，谢谢你留下的这句话 ♡");
        }
      } catch (err) {
        setStatus("没能贴上去，检查一下网络再试一次吧。");
      } finally {
        setBusy(false);
      }
    });

    /* 刷新后记住上次挑的纸 */
    try {
      const lastPaper = localStorage.getItem(PAPER_KEY);
      const input = lastPaper && form.querySelector('input[name="notePaper"][value="' + lastPaper + '"]');
      if (input) input.checked = true;
    } catch (err) {
      /* 忽略 */
    }
    $$('input[name="notePaper"]', form).forEach((input) => {
      input.addEventListener("change", () => {
        try {
          localStorage.setItem(PAPER_KEY, input.value);
        } catch (err) {
          /* 忽略 */
        }
      });
    });

    /* 管理模式：只有输入正确口令才能撕便签 */
    if (adminBtn) {
      adminBtn.addEventListener("click", () => {
        const pass = window.prompt("请输入管理口令");
        if (!pass) return;
        adminPass = pass;
        wall.classList.add("is-admin");
        setStatus("管理模式：点便签右上角的 × 可以撕掉它。");
      });
    }

    wall.addEventListener("click", async (e) => {
      const btn = e.target.closest(".note-del");
      if (!btn || !adminPass) return;
      if (!window.confirm("确定要撕掉这张便签吗？")) return;
      const id = btn.dataset.id;
      if (cloudOn) {
        try {
          const res = await fetch(CLOUD.url + "/rest/v1/rpc/delete_note", {
            method: "POST",
            headers: headers(),
            body: JSON.stringify({ note_id: id, admin_pass: adminPass }),
          });
          if (!res.ok) throw new Error("HTTP " + res.status);
        } catch (err) {
          setStatus("口令不对，或者删除失败。");
          adminPass = "";
          wall.classList.remove("is-admin");
          return;
        }
      }
      notes = notes.filter((note) => String(note.id) !== String(id));
      if (!cloudOn) writeLocal();
      render();
      setStatus("已经撕掉啦。");
    });

    /* 每次打开弹层都重新拉一次，保证看到最新留言 */
    $$('[data-modal="notesModal"]').forEach((trigger) => {
      trigger.addEventListener("click", () => {
        if (cloudOn) load();
      });
    });

    load();
  }

  /* ============================================================
     5. 照片：本地文件优先，缺失时用网络图兜底
     ============================================================ */
  function initImageFallback() {
    $$(".film-frame img, .life-shot img").forEach((img) => {
      const fallback = img.dataset.fallback;
      const apply = () => {
        if (fallback && img.getAttribute("src") !== fallback) {
          img.src = fallback;
          return;
        }
        img.removeAttribute("src");
        img.style.background = img.closest(".life-shot")
          ? "repeating-linear-gradient(135deg,#efece7,#efece7 8px,#e7e3dc 8px,#e7e3dc 16px)"
          : "repeating-linear-gradient(135deg,#232323,#232323 8px,#2b2b2b 8px,#2b2b2b 16px)";
      };
      img.addEventListener("error", apply);
      // 图片可能在脚本执行前就已加载失败，这里补一次兜底
      if (img.complete && img.naturalWidth === 0) apply();
    });
  }

  /* ============================================================
     6. 导航高亮 + 平滑滚动
     ============================================================ */
  function initNav() {
    const links = $$(".side-link:not([data-modal])");
    const sections = $$("main section[id]");

    const setActive = (id) => {
      links.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === "#" + id);
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { threshold: 0.4 }
    );

    sections.forEach((section) => observer.observe(section));

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        const targetId = link.getAttribute("href");
        if (!targetId || !targetId.startsWith("#")) return;
        const target = document.querySelector(targetId);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ============================================================
     初始化
     ============================================================ */
  document.addEventListener("DOMContentLoaded", () => {
    initCollage();
    initModals();
    initClock();
    initNotes();
    initImageFallback();
    initNav();
  });
})();
