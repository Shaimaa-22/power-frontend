import { Router, Routes } from './router';
import { I18nProvider } from './i18n/I18nProvider';
import Layout from './components/Layout';
import Home from './pages/Home';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

const routes = [
  { path: '/', element: <Home /> },
  { path: '/services', element: <Services /> },
  { path: '/services/:slug', element: <ServiceDetail /> },
  { path: '/about', element: <About /> },
  { path: '/contact', element: <Contact /> },
  { path: '*', element: <NotFound /> },
];

export default function App() {
  return (
    <I18nProvider>
      <Router>
        <Layout>
          <Routes routes={routes} />
        </Layout>
      </Router>
    </I18nProvider>
  );
}
