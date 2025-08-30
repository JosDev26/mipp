import { Nunito_Sans } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';

const nunito = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#7a1f26" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/icons/icon-192.svg" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className={nunito.className} style={{ margin: 0, background: '#f9f9f9' }}>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
