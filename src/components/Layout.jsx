import Header from './Header';
import Footer from './Footer';

export default function Layout({ children }) {
  return (
    <>
      <a className="skip-link" href="#content">
        Skip to content
      </a>
      <Header />
      <main id="content">{children}</main>
      <Footer />
    </>
  );
}
