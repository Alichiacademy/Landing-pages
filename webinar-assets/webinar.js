(function () {
  "use strict";

  const API_BASE = "https://apialichi.liara.run/api/v1/public/landing";
  const WEBINAR_SLUG = "formula-3";
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

  function randomToken() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function resolveDeviceId() {
    const storageKey = "alichi_webinar_device_v1";
    let value = "";
    try { value = localStorage.getItem(storageKey) || ""; } catch (_) {}
    if (!value) {
      const cookie = document.cookie.match(/(?:^|;\s*)alichi_webinar_device=([^;]+)/);
      value = cookie ? decodeURIComponent(cookie[1]) : randomToken();
    }
    try { localStorage.setItem(storageKey, value); } catch (_) {}
    document.cookie = "alichi_webinar_device=" + encodeURIComponent(value)
      + "; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
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
    return {
      device_id: resolveDeviceId(),
      fingerprint: await sha256(rawFingerprint)
    };
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
    const field = phone.closest(".field");
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
    return { valid: true, raw: digits };
  }

  async function api(path, payload) {
    const response = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      throw new Error(data.detail || "ارتباط با سرور برقرار نشد. دوباره تلاش کن.");
    }
    return data;
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
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tehran"
    }).format(new Date(value)) + " به وقت تهران";
  }

  function addNotice(container, error) {
    const notice = document.createElement("div");
    notice.className = "webinar-notice" + (error ? " error" : "");
    container.insertBefore(notice, container.firstChild);
    return notice;
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
      title.textContent = "ثبت‌نامت با موفقیت انجام شد";
      subtitle.textContent = message;
      linkSection.style.display = "";
      const reminder = linkSection.querySelector(".reminder-card");
      reminder.innerHTML = "وبینار <b>" + formatDate(startsAt) + "</b> شروع می‌شه. لینک ورود از نیم ساعت قبل فعال می‌شه.";
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
    const phoneValues = enhancePhoneField(document.getElementById("phone"));
    const formCard = form.closest(".form-card");
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
    const notice = addNotice(formCard, false);
    notice.classList.add("hidden");
    document.getElementById("residencyQuestion").classList.add("hidden");
    document.getElementById("goStep2").addEventListener("click", function () {
      goTo(1);
    });
    document.getElementById("backStep1").addEventListener("click", function () {
      goTo(0);
    });
    const entryLink = document.getElementById("webinarEntryLink");
    const entryParams = new URLSearchParams();
    Object.entries(source).forEach(function (item) {
      if (item[1]) entryParams.set(item[0], item[1]);
    });
    entryLink.href = "../Formula3_webinar_entry/"
      + (entryParams.toString() ? "?" + entryParams.toString() : "");

    const renderLocationNotice = function () {
      const values = phoneValues();
      const foreign = Boolean(timezone && timezone !== "Asia/Tehran")
        || values.country !== "IR";
      notice.classList.toggle("hidden", !foreign);
      if (foreign) {
        notice.textContent = "این نوبت وبینار برای افراد داخل ایران برگزار می‌شود. نسخه ویژه ایرانیان خارج از کشور به‌زودی روی پلتفرمی مناسب‌تر برگزار خواهد شد؛ محدودیت پلتفرم‌های داخلی فعلاً امکان ارائه پایدار برای خارج از ایران را نمی‌دهد.";
      }
    };
    form.querySelector("[data-country]").addEventListener("change", renderLocationNotice);
    renderLocationNotice();

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
      try {
        const identity = await identityPromise;
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
        showRegistrationResult(result.status, result.message, result.starts_at);
        form.reset();
      } catch (error) {
        message.textContent = error.message;
        message.classList.add("err");
      } finally {
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
    document.getElementById("accessCard").classList.add("hidden");
    document.getElementById("linkCard").classList.add("hidden");
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

  async function initEntry() {
    addEntryLogo();
    const waitingCard = document.getElementById("waitingCard");
    const accessCard = document.getElementById("accessCard");
    const linkCard = document.getElementById("linkCard");
    const form = document.getElementById("accessForm");
    const phoneValues = enhancePhoneField(document.getElementById("phone"));
    const fullnameField = document.getElementById("fullname").closest(".field");
    fullnameField.style.display = "none";
    document.getElementById("fullname").required = false;

    if (timezone && timezone !== "Asia/Tehran") {
      showEntryDenied("شما برای این وبینار ثبت‌نام نکرده‌اید.");
      return;
    }

    let config;
    try {
      config = await getConfig();
      document.getElementById("eventDate").textContent = formatDate(config.starts_at);
      document.getElementById("accessTime").textContent =
        new Intl.DateTimeFormat("fa-IR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Asia/Tehran"
        }).format(new Date(config.access_opens_at));
    } catch (error) {
      waitingCard.querySelector(".status-text").textContent = error.message;
      return;
    }

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
      message.textContent = "";
      message.className = "form-msg";
      if (!values.normalized.valid) {
        message.textContent = values.normalized.message;
        message.classList.add("error");
        return;
      }
      button.disabled = true;
      button.textContent = "در حال بررسی...";
      try {
        const identity = await identityPromise;
        const result = await api("/webinars/" + WEBINAR_SLUG + "/entry", {
          raw_phone: values.normalized.raw,
          country_iso: values.country,
          custom_dial_code: values.country === "OTHER" ? values.customDial : null,
          timezone: timezone,
          device_id: identity.device_id,
          fingerprint: identity.fingerprint,
          source_code: source.source_code
        });
        if (result.status !== "granted") {
          message.textContent = result.message;
          message.classList.add("error");
          return;
        }
        accessCard.classList.add("hidden");
        linkCard.classList.remove("hidden");
        document.getElementById("joinLink").href = result.webinar_url;
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        message.textContent = error.message;
        message.classList.add("error");
      } finally {
        button.disabled = false;
        button.textContent = "دریافت لینک ورود";
      }
    }, true);
  }

  if (pageType === "registration") initRegistration();
  if (pageType === "entry") initEntry();
})();
