/**
 * Rewrites image src paths in question/explanation HTML so they resolve relative
 * to the exam's public dir (`exams/<examId>/images/`), regardless of which
 * route the user is currently viewing.
 *
 * Source HTML uses `src="./images/<basename>"` written by extract.py.
 */
export function rewriteImages(html: string, examId: string): string {
  if (!html) return html;
  return html.replace(
    /src="\.\/images\/([^"]+)"/g,
    (_m, name) => `src="exams/${examId}/images/${name}"`
  );
}

/** Make every link open in a new tab so the quiz in progress isn't lost. */
export function linksInNewTab(html: string): string {
  if (!html) return html;
  return html.replace(/<a\b([^>]*)>/gi, (_m, attrs: string) => {
    const a = attrs.replace(/\s(target|rel)="[^"]*"/gi, "");
    return `<a${a} target="_blank" rel="noopener noreferrer">`;
  });
}

/** Question/explanation HTML ready for rendering. */
export function renderHtml(html: string | undefined, examId: string): string {
  return linksInNewTab(rewriteImages(html || "", examId));
}
