(function () {
  "use strict";

  const API_BASE = "https://apialichi.liara.run/api/v1/public/landing";
  const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzDVP7V8LBLVlJQgdss5NSph8fQaZqPt1500MWynUt6RNafclVV88BK_Tdvy1Ij4TzKcA/exec";
  const WEBINAR_SLUG = "formula-3";
  const WEBINAR_URL = "https://www.skyroom.online/ch/alialichi/formula3";
  // Sunday, August 30, 2026 — 14:00 Tehran (10:30 UTC).
  // Entry opens 15 minutes before the start.
  const WEBINAR_STARTS_AT = "2026-08-30T10:30:00Z";
  const WEBINAR_ACCESS_OPENS_AT = "2026-08-30T10:15:00Z";
  const pageType = document.body.dataset.page;
  const timezone = resolveTimezone();
  const source = readSource();
  const identityPromise = buildIdentity();
  const countryRules = {
    IR: { dial: "98", sample: "9123456789", pattern: /^9\d{9}$/ },
    AF: { dial: "93", sample: "701234567", pattern: /^7\d{8}$/ },
    TR: { dial: "90", sample: "5012345678", pattern: /^5\d{9}$/ },
    AE: { dial: "971", sample: "501234567", pattern: /^5\d{8}$/ },
    IQ: { dial: "964", sample: "7712345678", pattern: /^7\d{9}$/ },
    US: { dial: "1", sample: "2025550123", pattern: /^[2-9]\d{9}$/ },
    CA: { dial: "1", sample: "4165550123", pattern: /^[2-9]\d{9}$/ },
    GB: { dial: "44", sample: "7123456789", pattern: /^7\d{9}$/ },
    DE: { dial: "49", sample: "15123456789", pattern: /^1[5-7]\d{8,9}$/ },
    FR: { dial: "33", sample: "612345678", pattern: /^[67]\d{8}$/ },
    NL: { dial: "31", sample: "612345678", pattern: /^6\d{8}$/ },
    SE: { dial: "46", sample: "701234567", pattern: /^7\d{8}$/ },
    AU: { dial: "61", sample: "412345678", pattern: /^4\d{8}$/ }
  };
  const countries = [
    ["IR", "ایران (+98)"], ["AF", "افغانستان (+93)"], ["TR", "ترکیه (+90)"],
    ["AE", "امارات (+971)"], ["IQ", "عراق (+964)"], ["US", "آمریکا (+1)"],
    ["CA", "کانادا (+1)"], ["GB", "بریتانیا (+44)"], ["DE", "آلمان (+49)"],
    ["FR", "فرانسه (+33)"], ["NL", "هلند (+31)"], ["SE", "سوئد (+46)"],
    ["AU", "استرالیا (+61)"], ["OTHER", "کشور دیگر"]
  ];
  const decimalRanges = [
    0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66,
    0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090,
    0x17e0, 0x1810, 0xff10
  ];

  function toEnglishDigits(value) {
    return Array.from(String(value || "").normalize("NFKC")).map(function (character) {
      const code = character.codePointAt(0);
      for (const start of decimalRanges) {
        if (code >= start && code <= start + 9) return String(code - start);
      }
      return character;
    }).join("");
  }

  function resolveTimezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }
    catch (_) { return ""; }
  }

  function readSource() {
    const params = new URLSearchParams(location.search);
    return {
      source_code: params.get("source_code") || params.get("source") || null,
      utm_source: params.get("utm_source") || null,
      utm_medium: params.get("utm_medium") || null,
      utm_campaign: params.get("utm_campaign") || null
    };
  }

  function sourceLabel() {
    return source.source_code || source.utm_source || "بدون تگ / ارگانیک";
  }

  function browserRegion() {
    for (const language of navigator.languages || [navigator.language || ""]) {
      const match = String(language).toUpperCase().match(/-([A-Z]{2})$/);
      if (match) return match[1];
    }
    return "نامشخص";
  }

  function randomToken() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      if (window.crypto && crypto.getRandomValues) {
        const bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
      }
    } catch (_) {}
    return [
      Date.now().toString(36),
      Math.random().toString(36).slice(2),
      Math.random().toString(36).slice(2)
    ].join("-");
  }

  function resolveDeviceId() {
    const storageKey = "alichi_webinar_device_v1";
    let value = "";
    try { value = localStorage.getItem(storageKey) || ""; } catch (_) {}
    if (!value) {
      try {
        const cookie = document.cookie.match(/(?:^|;\s*)alichi_webinar_device=([^;]+)/);
        value = cookie ? decodeURIComponent(cookie[1]) : "";
      } catch (_) {}
    }
    if (!value) value = randomToken();
    try { localStorage.setItem(storageKey, value); } catch (_) {}
    try {
      document.cookie = "alichi_webinar_device=" + encodeURIComponent(value)
        + "; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
    } catch (_) {}
    return value;
  }

  async function sha256(value) {
    try {
      if (!window.crypto || !crypto.subtle || !window.TextEncoder) return value;
      const bytes = new TextEncoder().encode(value);
      const digest = await Promise.race([
        crypto.subtle.digest("SHA-256", bytes),
        new Promise(function (_, reject) {
          window.setTimeout(function () {
            reject(new Error("fingerprint_timeout"));
          }, 1200);
        })
      ]);
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    } catch (_) {
      return value;
    }
  }

  async function buildIdentity() {
    try {
      const rawFingerprint = [
        navigator.platform || "",
        (navigator.languages || [navigator.language || ""]).join(","),
        screen.width + "x" + screen.height,
        screen.colorDepth || "",
        navigator.hardwareConcurrency || "",
        navigator.deviceMemory || "",
        navigator.maxTouchPoints || "",
        timezone
      ].join("|");
      return {
        device_id: resolveDeviceId(),
        fingerprint: await sha256(rawFingerprint)
      };
    } catch (_) {
      return {
        device_id: resolveDeviceId(),
        fingerprint: null
      };
    }
  }

  async function resolveIdentity() {
    const fallback = {
      device_id: resolveDeviceId(),
      fingerprint: null
    };
    try {
      return await Promise.race([
        identityPromise,
        new Promise(function (resolve) {
          window.setTimeout(function () {
            resolve(fallback);
          }, 1600);
        })
      ]);
    } catch (_) {
      return fallback;
    }
  }

  function createCountrySelect() {
    const select = document.createElement("select");
    select.setAttribute("data-country", "");
    select.setAttribute("aria-label", "کشور و پیش‌شماره");
    countries.forEach(function (country) {
      const option = document.createElement("option");
      option.value = country[0];
      option.textContent = country[1];
      select.appendChild(option);
    });
    return select;
  }

  function enhancePhoneField(phone) {
    if (!phone) {
      throw new Error("فیلد شماره موبایل در صفحه پیدا نشد.");
    }
    const field = phone.closest(".field");
    if (!field) {
      throw new Error("ساختار فیلد شماره موبایل معتبر نیست.");
    }
    const grid = document.createElement("div");
    const country = createCountrySelect();
    const customField = document.createElement("div");
    const customLabel = document.createElement("label");
    const customDial = document.createElement("input");
    const help = document.createElement("p");

    grid.className = "phone-grid";
    phone.parentNode.insertBefore(grid, phone);
    grid.append(country, phone);
    phone.setAttribute("data-phone", "");
    phone.autocomplete = "tel-national";

    customField.className = "field custom-dial-field hidden";
    customLabel.textContent = "پیش‌شماره کشور";
    customDial.type = "tel";
    customDial.inputMode = "numeric";
    customDial.placeholder = "مثلاً 81";
    customDial.setAttribute("data-custom-dial", "");
    customField.append(customLabel, customDial);
    field.appendChild(customField);

    help.className = "phone-help";
    help.textContent = "شماره را بدون صفر اول وارد کن؛ ارقام فارسی، عربی و سایر زبان‌ها خودکار تبدیل می‌شوند.";
    field.appendChild(help);

    const update = function () {
      const rule = countryRules[country.value];
      customField.classList.toggle("hidden", country.value !== "OTHER");
      phone.placeholder = rule ? rule.sample : "شماره بدون پیش‌شماره";
    };
    country.addEventListener("change", update);
    [phone, customDial].forEach(function (input) {
      input.addEventListener("input", function () {
        input.value = toEnglishDigits(input.value);
      });
    });
    update();

    return function getPhoneValues() {
      return {
        country: country.value,
        customDial: customDial.value,
        normalized: normalizePhone(phone.value, country.value, customDial.value)
      };
    };
  }

  function normalizePhone(raw, country, customDialCode) {
    let digits = toEnglishDigits(raw).replace(/\D/g, "");
    const rule = countryRules[country];
    const dial = rule ? rule.dial : toEnglishDigits(customDialCode).replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (dial && digits.startsWith(dial)) digits = digits.slice(dial.length);
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (rule && !rule.pattern.test(digits)) {
      return { valid: false, message: "شماره موبایل برای پیش‌شماره انتخاب‌شده معتبر نیست." };
    }
    if (!rule && (!/^\d{1,4}$/.test(dial) || !/^\d{6,14}$/.test(digits))) {
      return { valid: false, message: "پیش‌شماره و شماره بین‌المللی را بررسی کن." };
    }
    return {
      valid: true,
      raw: digits,
      e164: "+" + dial + digits
    };
  }

  const SHEET_QUEUE_KEY = "alichi_webinar_sheet_queue_v2";
  let sheetFlushPromise = null;

  function readSheetQueue() {
    try {
      const value = JSON.parse(localStorage.getItem(SHEET_QUEUE_KEY) || "[]");
      return Array.isArray(value) ? value.slice(-100) : [];
    } catch (_) {
      return [];
    }
  }

  function writeSheetQueue(queue) {
    try {
      localStorage.setItem(SHEET_QUEUE_KEY, JSON.stringify(queue.slice(-100)));
      return true;
    } catch (_) {
      return false;
    }
  }

  function clientEventId() {
    return randomToken() + "-" + Date.now().toString(36);
  }

  function removeSheetEvent(eventId) {
    const queue = readSheetQueue().filter(item => item._client_event_id !== eventId);
    writeSheetQueue(queue);
  }

  async function dispatchSheetPayload(payload) {
    const controller = window.AbortController ? new AbortController() : null;
    let timeoutId;
    try {
      const request = fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
      await Promise.race([
        request,
        new Promise(function (_, reject) {
          timeoutId = window.setTimeout(function () {
            if (controller) controller.abort();
            reject(new Error("sheet_timeout"));
          }, 4500);
        })
      ]);
      return true;
    } catch (_) {
      return false;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  async function flushSheetQueue() {
    if (sheetFlushPromise) return sheetFlushPromise;
    sheetFlushPromise = (async function () {
      const queue = readSheetQueue();
      for (const payload of queue) {
        const sent = await dispatchSheetPayload(payload);
        if (!sent) break;
        removeSheetEvent(payload._client_event_id);
      }
    })().finally(function () {
      sheetFlushPromise = null;
    });
    return sheetFlushPromise;
  }

  function saveToSheet(formName, fields) {
    const payload = {
      formName: formName,
      ...fields,
      "منبع (Source)": sourceLabel(),
      "منطقه زمانی": timezone || "نامشخص",
      "ریجن مرورگر": browserRegion(),
      "آدرس صفحه": window.location.href,
      "_client_event_id": clientEventId(),
      "_client_created_at_utc": new Date().toISOString(),
      "_page_type": pageType || "unknown",
      "_schema_version": "webinar-sheet-v2"
    };
    const queue = readSheetQueue();
    queue.push(payload);
    const queued = writeSheetQueue(queue);
    return dispatchSheetPayload(payload).then(function (sent) {
      if (sent) removeSheetEvent(payload._client_event_id);
      flushSheetQueue();
      let beaconQueued = false;
      if (!sent && !queued && navigator.sendBeacon) {
        try {
          beaconQueued = navigator.sendBeacon(
            GOOGLE_SCRIPT_URL,
            new Blob([JSON.stringify(payload)], { type: "text/plain;charset=utf-8" })
          );
        } catch (_) {}
      }
      return {
        accepted: sent || queued || beaconQueued,
        dispatched: sent || beaconQueued,
        queued: !sent && (queued || beaconQueued)
      };
    });
  }

  async function api(path, payload) {
    const request = async function () {
      const controller = window.AbortController ? new AbortController() : null;
      let timeoutId;
      try {
        return await Promise.race([
          fetch(API_BASE + path, {
            method: "POST",
            mode: "cors",
            cache: "no-store",
            credentials: "omit",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller ? controller.signal : undefined
          }),
          new Promise(function (_, reject) {
            timeoutId = window.setTimeout(function () {
              if (controller) controller.abort();
              reject(new Error("api_timeout"));
            }, 6000);
          })
        ]);
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    };
    try {
      const response = await request();
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        const responseError = new Error(data.detail || "ارتباط با سرور برقرار نشد. دوباره تلاش کن.");
        responseError.isNetworkError = response.status >= 500;
        throw responseError;
      }
      return data;
    } catch (error) {
      if (typeof error.isNetworkError === "boolean") throw error;
      const networkError = new Error("ارتباط با سرور ثبت‌نام برقرار نشد.");
      networkError.isNetworkError = true;
      throw networkError;
    }
  }

  async function getConfig() {
    const response = await fetch(
      API_BASE + "/webinars/" + WEBINAR_SLUG + "/config",
      { cache: "no-store" }
    );
    if (!response.ok) throw new Error("تنظیمات وبینار دریافت نشد.");
    return response.json();
  }

  function formatDate(value) {
    const date = new Date(value);
    const dateParts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tehran"
    }).formatToParts(date);
    const timeText = new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tehran"
    }).format(date);
    const values = {};
    dateParts.forEach(function (part) {
      if (part.type !== "literal") values[part.type] = part.value;
    });
    return [
      values.weekday,
      "،",
      values.day,
      values.month,
      values.year,
      "ساعت",
      timeText
    ].filter(Boolean).join(" ").replace(" ،", "،") + " به وقت تهران";
  }

  function showRegistrationResult(status, message, startsAt) {
    const step3 = document.getElementById("step3");
    const dot3 = document.getElementById("dot3");
    const title = step3.querySelector("h2");
    const subtitle = document.getElementById("step3Subtitle");
    const icon = step3.querySelector(".success-icon");
    const linkSection = document.getElementById("linkSection");

    [document.getElementById("step1"), document.getElementById("step2"), step3]
      .forEach(step => step.classList.remove("active"));
    document.querySelectorAll(".progress .dot").forEach(dot => dot.classList.remove("active"));
    step3.classList.add("active");
    dot3.classList.add("active");
    step3.classList.toggle("result-state", status !== "registered");

    if (status === "registered") {
      icon.textContent = "✓";
      title.textContent = "بهت تبریک می‌گم، ثبت‌نامت انجام شد.";
      subtitle.textContent = "";
      linkSection.style.display = "";
    } else {
      icon.textContent = "!";
      title.textContent = status === "capacity_full" ? "ظرفیت تکمیل شده" : "اطلاعیه وبینار";
      subtitle.textContent = message;
      linkSection.style.display = "none";
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function initRegistration() {
    const form = document.getElementById("leadForm");
    if (!form) return;
    const phoneField = form.querySelector("#phone");
    const phoneValues = enhancePhoneField(phoneField);
    const steps = [
      document.getElementById("step1"),
      document.getElementById("step2"),
      document.getElementById("step3")
    ];
    const dots = [
      document.getElementById("dot1"),
      document.getElementById("dot2"),
      document.getElementById("dot3")
    ];
    const goTo = function (index) {
      steps.forEach(step => step.classList.remove("active"));
      dots.forEach(dot => dot.classList.remove("active"));
      steps[index].classList.add("active");
      dots[index].classList.add("active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.getElementById("residencyQuestion").classList.add("hidden");
    const goStep2 = document.getElementById("goStep2");
    const backStep1 = document.getElementById("backStep1");
    if (goStep2) {
      goStep2.addEventListener("click", function () {
        goTo(1);
      });
    }
    if (backStep1) {
      backStep1.addEventListener("click", function () {
        goTo(0);
      });
    }
    const entryLink = document.getElementById("webinarEntryLink");
    const entryParams = new URLSearchParams();
    Object.entries(source).forEach(function (item) {
      if (item[1]) entryParams.set(item[0], item[1]);
    });
    const entryPath = "https://tests.alichiacademy.ir/F3_w_e/index.html"
      + (entryParams.toString() ? "?" + entryParams.toString() : "");
    if (entryLink) entryLink.href = entryPath;
    const entryUrlInput = document.getElementById("webinarEntryUrl");
    const copyEntryUrlButton = document.getElementById("copyWebinarEntryUrl");
    const copyEntryUrlStatus = document.getElementById("copyWebinarEntryStatus");
    if (entryUrlInput) {
      const entryUrl = new URL(entryPath, window.location.href);
      entryUrl.searchParams.delete("source_code");
      entryUrl.searchParams.set("source", "site");
      entryUrlInput.value = entryUrl.toString();
    }
    if (copyEntryUrlButton && entryUrlInput) {
      copyEntryUrlButton.addEventListener("click", async function () {
        try {
          await navigator.clipboard.writeText(entryUrlInput.value);
          copyEntryUrlStatus.textContent = "لینک ورود کپی شد.";
        } catch (_) {
          entryUrlInput.focus();
          entryUrlInput.select();
          const copied = document.execCommand("copy");
          copyEntryUrlStatus.textContent = copied
            ? "لینک ورود کپی شد."
            : "لینک را انتخاب و به‌صورت دستی کپی کن.";
        }
      });
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const message = document.getElementById("formMsg");
      const button = document.getElementById("submitBtn");
      const values = phoneValues();
      const fullName = document.getElementById("fullname").value.trim();
      message.textContent = "";
      message.className = "form-msg";
      if (fullName.length < 2) {
        message.textContent = "نام و نام خانوادگی رو کامل وارد کن";
        message.classList.add("err");
        return;
      }
      if (!values.normalized.valid) {
        message.textContent = values.normalized.message;
        message.classList.add("err");
        return;
      }
      button.disabled = true;
      button.textContent = "در حال ثبت...";
      const slowRequestTimer = window.setTimeout(function () {
        button.textContent = "ارتباط ضعیفه؛ کمی صبر کن...";
      }, 3500);
      try {
        const identity = await resolveIdentity();
        const result = await api("/webinars/" + WEBINAR_SLUG + "/register", {
          full_name: fullName,
          raw_phone: values.normalized.raw,
          country_iso: values.country,
          custom_dial_code: values.country === "OTHER" ? values.customDial : null,
          timezone: timezone,
          device_id: identity.device_id,
          fingerprint: identity.fingerprint,
          ...source
        });
        saveToSheet("Formula3_webinar", {
          "نام": fullName,
          "شماره تماس": values.normalized.e164,
          "کشور": values.country,
          "وضعیت": result.status === "registered"
            ? "ثبت‌نام وبینار فرمول ۳"
            : result.status === "iran_only"
              ? "خارج از ایران"
              : "ظرفیت تکمیل",
          "مقصد": result.status === "registered"
            ? "نمایش لینک ورود وبینار"
            : "عدم نمایش لینک ورود",
          "دلیل هدایت": result.message || result.status,
          "سگمنت": result.status,
          "اثر دستگاه": identity.fingerprint
        });
        showRegistrationResult(result.status, result.message, result.starts_at);
        form.reset();
      } catch (error) {
        const sheetSaved = await saveToSheet("Formula3_webinar", {
          "نام": fullName,
          "شماره تماس": values.normalized.e164,
          "کشور": values.country,
          "وضعیت": error.isNetworkError ? "ثبت‌نام وبینار فرمول ۳ - جایگزین" : "خطای ثبت در API",
          "مقصد": error.isNetworkError ? "نمایش لینک ورود وبینار" : "ثبت در شیت",
          "دلیل هدایت": error.message
        });
        if (error.isNetworkError && sheetSaved) {
          showRegistrationResult(
            "registered",
            "ثبت‌نامت با موفقیت انجام شد.",
            WEBINAR_STARTS_AT
          );
          form.reset();
        } else {
          message.textContent = error.isNetworkError
            ? "ارتباط با سرور و شیت برقرار نشد. دوباره تلاش کن."
            : error.message;
          message.classList.add("err");
        }
      } finally {
        window.clearTimeout(slowRequestTimer);
        button.disabled = false;
        button.textContent = "ثبت‌نام رایگان";
      }
    }, true);
  }

  function addEntryLogo() {
    const registrationLogo = document.querySelector('link[rel="icon"]');
    if (!registrationLogo || !registrationLogo.href.startsWith("data:image")) return;
    const topbar = document.querySelector(".topbar");
    if (topbar.querySelector("img")) return;
    const logo = document.createElement("img");
    logo.src = registrationLogo.href;
    logo.alt = "لوگوی علی‌چی آکادمی";
    topbar.insertBefore(logo, topbar.firstChild);
  }

  function setCountdown(target) {
    const remaining = Math.max(0, new Date(target).getTime() - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const values = {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor(totalSeconds % 86400 / 3600),
      minutes: Math.floor(totalSeconds % 3600 / 60),
      seconds: totalSeconds % 60
    };
    Object.entries(values).forEach(function (item) {
      const element = document.getElementById(item[0]);
      if (element) {
        element.textContent = String(item[1]).padStart(2, "0")
          .replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
      }
    });
    return remaining;
  }

  function showEntryDenied(message) {
    document.getElementById("waitingCard").classList.add("hidden");
    const accessCard = document.getElementById("accessCard");
    const linkCard = document.getElementById("linkCard");
    accessCard.classList.add("hidden");
    linkCard.classList.add("hidden");
    let denied = document.getElementById("entryDeniedCard");
    if (!denied) {
      denied = document.createElement("section");
      denied.id = "entryDeniedCard";
      denied.className = "card entry-denied-card";
      denied.innerHTML = '<div class="status-icon">!</div><h2>دسترسی ثبت نشده</h2><p class="status-text"></p>';
      document.querySelector("main .container").appendChild(denied);
    }
    denied.querySelector(".status-text").textContent = message;
  }

  function revealClassAccess(accessCard, form, linkCard, webinarUrl) {
    form.classList.add("entry-form-verified");
    form.querySelectorAll("input, select").forEach(function (field) {
      field.disabled = true;
    });
    const submitButton = form.querySelector("#submitBtn");
    if (submitButton) submitButton.classList.add("hidden");
    const formMessage = form.querySelector("#formMsg");
    if (formMessage) {
      formMessage.textContent = "مشخصاتت تأیید شد.";
      formMessage.className = "form-msg success";
    }
    const privacy = accessCard.querySelector(".privacy");
    if (privacy) privacy.classList.add("hidden");
    linkCard.classList.remove("hidden");
    document.getElementById("joinLink").href = webinarUrl;
    linkCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function initEntry() {
    addEntryLogo();
    const waitingCard = document.getElementById("waitingCard");
    const accessCard = document.getElementById("accessCard");
    const linkCard = document.getElementById("linkCard");
    const form = document.getElementById("accessForm");
    if (!waitingCard || !accessCard || !linkCard || !form) return;
    const phoneValues = enhancePhoneField(form.querySelector("#phone"));
    const fullnameInput = document.getElementById("fullname");
    let config;
    try {
      config = await getConfig();
    } catch (error) {
      config = {
        starts_at: WEBINAR_STARTS_AT,
        access_opens_at: WEBINAR_ACCESS_OPENS_AT
      };
    }
    document.getElementById("eventDate").textContent = formatDate(config.starts_at);
    const render = function () {
      const remaining = setCountdown(config.access_opens_at);
      waitingCard.classList.toggle("hidden", remaining === 0);
      if (linkCard.classList.contains("hidden")) {
        accessCard.classList.toggle("hidden", remaining > 0);
      }
    };
    render();
    const timer = setInterval(function () {
      render();
      if (new Date(config.access_opens_at).getTime() <= Date.now()) clearInterval(timer);
    }, 1000);

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const values = phoneValues();
      const message = document.getElementById("formMsg");
      const button = document.getElementById("submitBtn");
      const fullName = fullnameInput.value.trim();
      message.textContent = "";
      message.className = "form-msg";
      if (fullName.length < 2) {
        message.textContent = "نام و نام خانوادگی رو کامل وارد کن";
        message.classList.add("error");
        return;
      }
      if (!values.normalized.valid) {
        message.textContent = values.normalized.message;
        message.classList.add("error");
        return;
      }
      button.disabled = true;
      button.textContent = "در حال بررسی...";
      const slowRequestTimer = window.setTimeout(function () {
        button.textContent = "ارتباط ضعیفه؛ کمی صبر کن...";
      }, 3500);
      try {
        const identity = await resolveIdentity();
        await saveToSheet("Formula3_webinar_entry", {
          "نام": fullName,
          "شماره تماس": values.normalized.e164,
          "کشور": values.country,
          "وضعیت": "تلاش برای دریافت لینک ورود",
          "مقصد": "بررسی در دیتابیس و شیت",
          "دلیل هدایت": "entry_attempt",
          "اثر دستگاه": identity.fingerprint,
          "_event_type": "entry_attempt",
          "_api_status": "pending"
        });
        const result = await api("/webinars/" + WEBINAR_SLUG + "/entry", {
          raw_phone: values.normalized.raw,
          country_iso: values.country,
          custom_dial_code: values.country === "OTHER" ? values.customDial : null,
          timezone: timezone,
          device_id: identity.device_id,
          fingerprint: identity.fingerprint,
          source_code: source.source_code
        });
        await saveToSheet("Formula3_webinar_entry", {
          "نام": fullName,
          "شماره تماس": values.normalized.e164,
          "کشور": values.country,
          "وضعیت": result.status === "granted"
            ? "دریافت لینک ورود وبینار فرمول ۳"
            : "عدم دریافت لینک ورود وبینار فرمول ۳",
          "مقصد": result.status === "granted"
            ? "لینک اسکای‌روم وبینار"
            : "عدم نمایش لینک اسکای‌روم",
          "دلیل هدایت": result.message || result.status,
          "سگمنت": result.status,
          "اثر دستگاه": identity.fingerprint,
          "_event_type": "entry_result",
          "_api_status": result.status
        });
        if (result.status !== "granted") {
          message.textContent = result.message;
          message.classList.add("error");
          return;
        }
        revealClassAccess(accessCard, form, linkCard, result.webinar_url);
      } catch (error) {
        const sheetSaved = await saveToSheet("Formula3_webinar_entry", {
          "نام": fullName,
          "شماره تماس": values.normalized.e164,
          "کشور": values.country,
          "وضعیت": error.isNetworkError ? "دریافت لینک ورود وبینار فرمول ۳ - جایگزین" : "خطای بررسی ورود در API",
          "مقصد": error.isNetworkError ? "لینک اسکای‌روم وبینار" : "ثبت در شیت",
          "دلیل هدایت": error.message,
          "_event_type": "entry_api_error",
          "_api_status": "failed"
        });
        if (error.isNetworkError && sheetSaved.accepted) {
          revealClassAccess(accessCard, form, linkCard, WEBINAR_URL);
        } else {
          message.textContent = error.isNetworkError
            ? "ارتباط با سرور و شیت برقرار نشد. دوباره تلاش کن."
            : error.message;
          message.classList.add("error");
        }
      } finally {
        window.clearTimeout(slowRequestTimer);
        button.disabled = false;
        button.textContent = "دریافت لینک ورود";
      }
    }, true);
  }

  function boot() {
    flushSheetQueue();
    window.addEventListener("online", flushSheetQueue);
    window.addEventListener("pagehide", function () {
      const queue = readSheetQueue();
      if (!navigator.sendBeacon) return;
      queue.forEach(function (payload) {
        try {
          navigator.sendBeacon(
            GOOGLE_SCRIPT_URL,
            new Blob([JSON.stringify(payload)], { type: "text/plain;charset=utf-8" })
          );
        } catch (_) {}
      });
    });
    if (pageType === "registration") initRegistration();
    if (pageType === "entry") initEntry();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
