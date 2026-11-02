const CURRENT_YEAR = new Date().getFullYear()

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="footer-mark" aria-hidden="true">J</span>
          <div>
            <strong>JobConnect<span>.</span></strong>
            <p>Better work starts with a better connection.</p>
          </div>
        </div>
        <div className="footer-meta">
          <a href="/#jobs">Explore opportunities</a>
          <span>© {CURRENT_YEAR} JobConnect</span>
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
