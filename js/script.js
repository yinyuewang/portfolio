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

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => openModal(trigger.dataset.modal));
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
     4. 照片：本地文件优先，缺失时用网络图兜底
     ============================================================ */
  function initImageFallback() {
    $$(".film-frame img, .life-shot img").forEach((img) => {
      const fallback = img.dataset.fallback;
      img.addEventListener("error", () => {
        if (fallback && img.src !== fallback) {
          img.src = fallback;
          return;
        }
        img.removeAttribute("src");
        img.style.background = img.closest(".life-shot")
          ? "repeating-linear-gradient(135deg,#efece7,#efece7 8px,#e7e3dc 8px,#e7e3dc 16px)"
          : "repeating-linear-gradient(135deg,#232323,#232323 8px,#2b2b2b 8px,#2b2b2b 16px)";
      });
    });
  }

  /* ============================================================
     4. 导航高亮 + 平滑滚动
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
    initImageFallback();
    initNav();
  });
})();
