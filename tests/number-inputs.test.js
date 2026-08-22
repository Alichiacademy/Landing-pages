const test = require("node:test");
const assert = require("node:assert/strict");

const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC = "٠١٢٣٤٥٦٧٨٩";

function toEnglishDigits(value) {
  return String(value == null ? "" : value).replace(/[۰-۹٠-٩]/g, digit => {
    const fa = PERSIAN.indexOf(digit);
    return String(fa > -1 ? fa : ARABIC.indexOf(digit));
  });
}

function normalizeNumber(value, allowDecimal) {
  let normalized = toEnglishDigits(value)
    .replace(/[−﹣－‒–—]/g, "-")
    .replace(/[٫،]/g, ".")
    .replace(/\s+/g, "")
    .replace(allowDecimal ? /[^0-9.+-]/g : /[^0-9+-]/g, "")
    .replace(/(?!^)[+-]/g, "");
  if (allowDecimal) {
    const firstDot = normalized.indexOf(".");
    if (firstDot > -1) normalized = normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, "");
  }
  return normalized;
}

test("converts Persian and Arabic-Indic digits", () => {
  assert.equal(toEnglishDigits("۰۱۲۳۴۵۶۷۸۹"), "0123456789");
  assert.equal(toEnglishDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789");
  assert.equal(toEnglishDigits("قد: ۱۷۵"), "قد: 175");
});

test("normalizes localized decimal input", () => {
  assert.equal(normalizeNumber("−۷۵٫۵ کیلو", true), "-75.5");
  assert.equal(normalizeNumber("۱۲۳،۴۵", true), "123.45");
});

test("normalizes integer input", () => {
  assert.equal(normalizeNumber("+۹۸ ۰۹۱۲۳۴۵۶۷۸۹", false), "+9809123456789");
  assert.equal(normalizeNumber("۱۷۵.۵", false), "1755");
});
