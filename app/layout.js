import { Nunito_Sans } from 'next/font/google';
import './globals.css';

const nunito = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
});

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={nunito.className} style={{ margin: 0, background: '#f9f9f9' }}>
        {children}
      </body>
    </html>
  );
}
