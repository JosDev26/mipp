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
    <div className={s['login-container']}>
      {/* Izquierda: fondo granate, sol, título y edificios */}
      <section className={s['left-section']} aria-hidden>
        <div className={s['sun-container']}>
          <Image src="/images/Sol.png" alt="Sol" className={s['sun-image']} width={160} height={160} priority />
        </div>
        <div className={s['title-container']}>
          <div className={s['title-content']}>
            <h1 className={s['main-title']}>Modulo Inteligente de Permisos de Personal +</h1>
          </div>
        </div>
        <div className={s['buildings-container']}>
          <Image src="/images/edificios.png" alt="Edificios" className={s['edificios-image']} width={800} height={200} />
        </div>
      </section>

      {/* Derecha: logos y formulario centrado */}
      <section className={s['right-section']}>
        <header className={s['header-logos']}>
          <div className={s['logo-tpmn']}>
            <Image src="/images/logoCTPMN.png" alt="TPMN Logo" className={s['tpmn-logo']} width={200} height={100} priority />
          </div>
          <div className={s['logo-mipp']}>
            <Image src="/images/logoMIPP.png" alt="MIPP+ Logo" className={s['mipp-logo']} width={160} height={40} />
          </div>
        </header>
        <div className={s['form-container']}>
          <div className={s['form-wrapper']}>
            <div className={s['form-header']}>
              <h2 className={s['form-title']}>Inicio de Sesión</h2>
            </div>
            <div className={s.cardWrap}>
              <LoginForm />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
