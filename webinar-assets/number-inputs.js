(function () {
  "use strict";

  var PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
  var ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

  function toEnglishDigits(value) {
    return String(value == null ? "" : value).replace(/[۰-۹٠-٩]/g, function (digit) {
      var index = PERSIAN_DIGITS.indexOf(digit);
      return String(index > -1 ? index : ARABIC_DIGITS.indexOf(digit));
    });
  }

  function normalizeNumber(value, allowDecimal) {
    var normalized = toEnglishDigits(value)
      .replace(/[−﹣－‒–—]/g, "-")
      .replace(/[٫،]/g, ".")
      .replace(/\s+/g, "")
      .replace(allowDecimal ? /[^0-9.+-]/g : /[^0-9+-]/g, "")
      .replace(/(?!^)[+-]/g, "");
    if (allowDecimal) {
      var firstDot = normalized.indexOf(".");
      if (firstDot > -1) {
        normalized = normalized.slice(0, firstDot + 1) +
          normalized.slice(firstDot + 1).replace(/\./g, "");
      }
    }
    return normalized;
  }

  function prepare(element) {
    if (!element || element.tagName !== "INPUT" ||
        (element.type !== "number" && !element.hasAttribute("data-number-input"))) return;
    var decimal = element.getAttribute("inputmode") === "decimal" ||
      element.hasAttribute("data-decimal");
    element.setAttribute("data-number-input", "");
    if (element.type === "number") element.type = "text";
    element.setAttribute("inputmode", decimal ? "decimal" : "numeric");
    element.setAttribute("dir", "ltr");
    if (element.dataset.numberInputReady === "true") return;
    element.dataset.numberInputReady = "true";
    element.addEventListener("input", function () {
      var next = normalizeNumber(element.value, decimal);
      if (next !== element.value) element.value = next;
    });
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    Array.prototype.forEach.call(
      root.querySelectorAll("input[type=number], input[data-number-input]"),
      prepare
    );
    if (root.matches && root.matches("input[type=number], input[data-number-input]")) prepare(root);
  }

  scan(document);
  new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      Array.prototype.forEach.call(mutation.addedNodes, function (node) {
        if (node.nodeType === 1) scan(node);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.toEnglishDigits = window.toEnglishDigits || toEnglishDigits;
  window.normalizeNumberInput = window.normalizeNumberInput || normalizeNumber;
})();
