(function () {
  "use strict";

  const API_BASE = "https://apialichi.liara.run/api/v1/public/landing";
  const WEBINAR_SLUG = "formula-3";
  const pageType = document.body.dataset.page;
  const timezone = getTimezone();
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

  function getTimezone() {
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

  function randomToken() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function deviceId() {
    const key = "alichi_webinar_device_v1";
    let value = "";
    try { value = localStorage.getItem(key) || ""; } catch (_) {}
    if (!value) {
      const cookie = document.cookie.match(/(?:^|;\s*)alichi_webinar_device=([^;]+)/);
      value = cookie ? decodeURIComponent(cookie[1]) : randomToken();
    }
    try { localStorage.setItem(key, value); } catch (_) {}
    document.cookie = "alichi_webinar_device=" + encodeURIComponent(value) + "; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
    return value;
  }

  async function sha256(value) {
    if (!crypto.subtle) return value;
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  async function buildIdentity() {
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
    return { device_id: deviceId(), fingerprint: await sha256(rawFingerprint) };
  }

  function participantIsAbroad(country) {
    return Boolean(timezone && timezone !== "Asia/Tehran") || country !== "IR";
  }

  function normalizePhone(raw, country, customDialCode) {
    let digits = toEnglishDigits(raw).replace(/\D/g, "");
    const rule = countryRules[country];
    let dial = rule ? rule.dial : toEnglishDigits(customDialCode).replace(/\D/g, "");
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (dial && digits.startsWith(dial)) digits = digits.slice(dial.length);
    if (digits.startsWith("0")) digits = digits.slice(1);
    if (rule && !rule.pattern.test(digits)) {
      return { valid: false, message: "شماره موبایل برای پیش‌شماره انتخاب‌شده معتبر نیست." };
    }
    if (!rule && (!/^\d{1,4}$/.test(dial) || !/^\d{6,14}$/.test(digits))) {
      return { valid: false, message: "پیش‌شماره و شماره بین‌المللی را بررسی کنید." };
    }
    return { valid: true, raw: digits, dial: dial };
  }

  async function api(path, payload) {
    const response = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.detail || "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    return data;
  }

  async function getConfig() {
    const response = await fetch(API_BASE + "/webinars/" + WEBINAR_SLUG + "/config", { cache: "no-store" });
    if (!response.ok) throw new Error("تنظیمات وبینار دریافت نشد.");
    return response.json();
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran"
    }).format(new Date(value)) + " به وقت تهران";
  }

  function setupPhoneForm(form) {
    const country = form.querySelector("[data-country]");
    const phone = form.querySelector("[data-phone]");
    const customDial = form.querySelector("[data-custom-dial]");
    const customField = form.querySelector("[data-custom-field]");
    const abroadNotice = document.querySelector("[data-abroad-notice]");
    const update = function () {
      const rule = countryRules[country.value];
      customField.classList.toggle("hidden", country.value !== "OTHER");
      phone.placeholder = rule ? rule.sample : "شماره بدون پیش‌شماره";
      const abroad = participantIsAbroad(country.value);
      if (abroadNotice) abroadNotice.classList.toggle("hidden", !abroad);
    };
    country.addEventListener("change", update);
    [phone, customDial].forEach(function (input) {
      input.addEventListener("input", function () {
        input.value = toEnglishDigits(input.value);
      });
    });
    update();
    return {
      values: function () {
        const normalized = normalizePhone(phone.value, country.value, customDial.value);
        return { normalized: normalized, country: country.value, customDial: customDial.value };
      }
    };
  }

  function showResult(status, message) {
    const formCard = document.querySelector("[data-form-card]");
    const resultCard = document.querySelector("[data-result-card]");
    resultCard.querySelector("[data-result-title]").textContent =
      status === "registered" ? "ثبت‌نام انجام شد" :
      status === "capacity_full" ? "ظرفیت تکمیل شده" : "اطلاعیه وبینار";
    resultCard.querySelector("[data-result-message]").textContent = message;
    resultCard.querySelector(".status-icon").textContent = status === "registered" ? "✓" : "!";
    formCard.classList.add("hidden");
    resultCard.classList.remove("hidden");
    scrollTo({ top: 0, behavior: "smooth" });
  }

  async function initRegistration() {
    const form = document.querySelector("form");
    const phoneForm = setupPhoneForm(form);
    const dateElement = document.querySelector("[data-event-date]");
    getConfig().then(config => { dateElement.textContent = formatDate(config.starts_at); }).catch(function () {});
    if (timezone && timezone !== "Asia/Tehran") {
      document.querySelector("[data-abroad-notice]").classList.remove("hidden");
    }
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const message = form.querySelector("[data-message]");
      message.textContent = "";
      const phoneValues = phoneForm.values();
      if (!phoneValues.normalized.valid) {
        message.textContent = phoneValues.normalized.message;
        return;
      }
      const fullName = form.querySelector("[data-name]").value.trim();
      if (fullName.length < 2) {
        message.textContent = "نام و نام خانوادگی را کامل وارد کنید.";
        return;
      }
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      button.textContent = "در حال ثبت...";
      try {
        const identity = await identityPromise;
        const result = await api("/webinars/" + WEBINAR_SLUG + "/register", {
          full_name: fullName,
          raw_phone: phoneValues.normalized.raw,
          country_iso: phoneValues.country,
          custom_dial_code: phoneValues.country === "OTHER" ? phoneValues.customDial : null,
          timezone: timezone,
          device_id: identity.device_id,
          fingerprint: identity.fingerprint,
          ...source
        });
        showResult(result.status, result.message);
      } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
        button.textContent = "ثبت‌نام در وبینار";
      }
    });
  }

  function updateCountdown(target) {
    const remaining = Math.max(0, new Date(target).getTime() - Date.now());
    const seconds = Math.floor(remaining / 1000);
    const values = [
      Math.floor(seconds / 86400),
      Math.floor(seconds % 86400 / 3600),
      Math.floor(seconds % 3600 / 60),
      seconds % 60
    ];
    document.querySelectorAll("[data-time]").forEach(function (element, index) {
      element.textContent = String(values[index]).padStart(2, "0").replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]);
    });
    return remaining;
  }

  async function initEntry() {
    const waitingCard = document.querySelector("[data-waiting-card]");
    const formCard = document.querySelector("[data-form-card]");
    const form = formCard.querySelector("form");
    const phoneForm = setupPhoneForm(form);
    try {
      const config = await getConfig();
      document.querySelector("[data-event-date]").textContent = formatDate(config.starts_at);
      const render = function () {
        const remaining = updateCountdown(config.access_opens_at);
        waitingCard.classList.toggle("hidden", remaining === 0);
        formCard.classList.toggle("hidden", remaining > 0);
      };
      render();
      const timer = setInterval(function () {
        render();
        if (new Date(config.access_opens_at).getTime() <= Date.now()) clearInterval(timer);
      }, 1000);
    } catch (error) {
      waitingCard.querySelector("[data-waiting-message]").textContent = error.message;
    }
    if (timezone && timezone !== "Asia/Tehran") {
      waitingCard.classList.add("hidden");
      formCard.classList.add("hidden");
      document.querySelector("[data-entry-blocked-card]").classList.remove("hidden");
      return;
    }
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const message = form.querySelector("[data-message]");
      message.textContent = "";
      const phoneValues = phoneForm.values();
      if (!phoneValues.normalized.valid) {
        message.textContent = phoneValues.normalized.message;
        return;
      }
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      button.textContent = "در حال بررسی...";
      try {
        const identity = await identityPromise;
        const result = await api("/webinars/" + WEBINAR_SLUG + "/entry", {
          raw_phone: phoneValues.normalized.raw,
          country_iso: phoneValues.country,
          custom_dial_code: phoneValues.country === "OTHER" ? phoneValues.customDial : null,
          timezone: timezone,
          device_id: identity.device_id,
          fingerprint: identity.fingerprint,
          source_code: source.source_code
        });
        if (result.status !== "granted") {
          message.textContent = result.message;
          return;
        }
        formCard.classList.add("hidden");
        const linkCard = document.querySelector("[data-link-card]");
        linkCard.querySelector("a").href = result.webinar_url;
        linkCard.classList.remove("hidden");
        scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        message.textContent = error.message;
      } finally {
        button.disabled = false;
        button.textContent = "دریافت لینک ورود";
      }
    });
  }

  if (pageType === "registration") initRegistration();
  if (pageType === "entry") initEntry();
})();
