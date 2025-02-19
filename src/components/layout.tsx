import Header from './header';
import 'normalize.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="Main">
      <Header />
      {children}
      <footer>
        {/* eslint-disable-next-line */}
        <center ya-i-used-a-center-tag="sue me">
          <p>
            Made by <a href="https://wesbos.com">Wes Bos</a> with{' '}
            <a href="https://www.remix.run">Remix</a> ©{' '}
            {new Date().getFullYear()}
          </p>
          <p>
            Source on{' '}
            <a href="https://github.com/wesbos/awesome-uses/">GitHub</a>. Add
            yourself!
          </p>
          <p>
            Icons from <a href="https://icons8.com">icons8.com</a>
          </p>
          <p>
            Domain provided by <a href="https://get.tech/">.Tech</a>
          </p>
          <p>
            Hosted on <a href="https://netlify.com">Netlify</a>
          </p>
          <p suppressHydrationWarning>Rendered Fresh</p>
        </center>
      </footer>
    </main>
  );
}
