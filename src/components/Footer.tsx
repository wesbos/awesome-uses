export default function Footer() {
  return (
    <footer>
      <center>
        <p>
          Made by <a href="https://wesbos.com">Wes Bos</a> and contributors ©{' '}
          {new Date().getFullYear()}
        </p>
        <p>
          Source on{' '}
          <a href="https://github.com/wesbos/awesome-uses/">GitHub</a>. Add
          yourself!
        </p>
        <p>
          Domain provided by <a href="https://get.tech/">.Tech</a>
        </p>
        <p>
          Hosted on <a href="https://cloudflare.com">Cloudflare</a>
        </p>
      </center>
    </footer>
  );
}
