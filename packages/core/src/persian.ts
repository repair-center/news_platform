const ZWNJ = '\u200c';

/** Canonical Persian text: ي/ى→ی، ك→ک، حذف اعراب و کشیده، یکسان‌سازی ارقام (به لاتین)، پاک‌سازی نیم‌فاصله و فاصله. */
export function normalizePersian(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u200b\u200d\u200e\u200f\u202a-\u202e]/g, '')
    .replace(/\u200c{2,}/g, ZWNJ)
    .replace(/\s*\u200c\s*/g, ZWNJ)
    .replace(/(^\u200c)|(\u200c$)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Key used for search and similarity: normalized, lower-cased, punctuation removed, ZWNJ treated as a space. */
export function toSearchKey(input: string): string {
  return normalizePersian(input)
    .toLowerCase()
    .replace(/\u200c/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/** Strips HTML tags/entities from feed excerpts. Output is plain text, never HTML. */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
