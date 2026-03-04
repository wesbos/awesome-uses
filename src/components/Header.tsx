export default function Header() {
  return (
    <header className="header HeaderWrapper">
      <style>{`
        @scope (.HeaderWrapper) {
          :scope { text-align: center; }
          h1 { font-size: 6rem; }
        }
      `}</style>
      <div>
        <h1 id="top">
          <a href="/">/uses</a>
        </h1>
        <p>
          A list of <code>/uses</code> pages detailing developer setups, gear,
          software and configs.
        </p>
      </div>
    </header>
  );
}
