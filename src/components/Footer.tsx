export default function Footer() {
  return (
    <footer className="border-t pt-6 pb-8 text-center text-sm text-muted-foreground space-y-1">
      <p>
        Made by{' '}
        <a href="https://wesbos.com" className="underline hover:text-foreground transition-colors">
          Wes Bos
        </a>{' '}
        and contributors &copy; {new Date().getFullYear()}
      </p>
      <p>
        Source on{' '}
        <a href="https://github.com/wesbos/awesome-uses/" className="underline hover:text-foreground transition-colors">
          GitHub
        </a>
        . Add yourself!
      </p>
      <p>
        Domain provided by{' '}
        <a href="https://get.tech/" className="underline hover:text-foreground transition-colors">
          .Tech
        </a>
        {' · '}
        Hosted on{' '}
        <a href="https://cloudflare.com" className="underline hover:text-foreground transition-colors">
          Cloudflare
        </a>
      </p>
    </footer>
  );
}
