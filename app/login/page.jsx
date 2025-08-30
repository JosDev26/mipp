import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import LoginForm from './LoginForm';
import s from './page.module.css';

export default async function Page() {
  const cookieStore = await cookies();
  // our authentication uses session_token cookie (JWT)
  const session = cookieStore.get('session_token');
  if (session) {
    // redirect server-side to avoid client flicker
    redirect('/home');
  }
  return (
    <div className={s.page}>
      <section className={s.left} aria-hidden>
  <div className={s.sun} />
  <h1 className={s.slogan}>“Modulo Inteligente de Permisos de Personal +”</h1>
      </section>
      <section className={s.right}>
        <header className={s.logos}>
          <div className={s.logoLeft}>
            <Image src="/images/login/tpmn.png" alt="TPMN" width={150} height={65} priority />
          </div>
          <div className={s.logoRight}>MIPP+</div>
        </header>
        <div className={s.centerBox}>
          <h2 className={s.loginTitle}>Inicio de Sesión</h2>
          <div className={s.cardWrap}>
            <LoginForm />
          </div>
        </div>
      </section>
    </div>
  );
}
