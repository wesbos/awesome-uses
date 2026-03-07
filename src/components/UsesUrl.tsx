type UsesUrlProps = {
  url: string;
  className?: string;
};

export function UsesUrl({ url, className }: UsesUrlProps) {
  const parsed = new URL(url);
  const host = parsed.host.replace(/^www\./, '');
  const path = parsed.pathname.replace(/\/$/, '');
  const usesIdx = path.toLowerCase().indexOf('/uses');

  let before: string;
  let uses: string;
  let after: string;

  if (usesIdx !== -1) {
    before = host + path.slice(0, usesIdx);
    uses = path.slice(usesIdx, usesIdx + 5);
    after = path.slice(usesIdx + 5);
  } else {
    before = host + path;
    uses = '';
    after = '';
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className={className}
    >
      {before}
      {uses && <span className="text-yellow-500">{uses}</span>}
      {after}
    </a>
  );
}
