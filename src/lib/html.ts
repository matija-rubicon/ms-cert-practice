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
