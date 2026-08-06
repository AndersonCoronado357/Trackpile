import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService, describeError } from '../../core/api.service';
import { AuthConfigService } from '../../core/auth-config.service';
import { SessionStore } from '../../core/session.store';
import { IconComponent } from '../../shared/icon';
import { FieldComponent } from '../../shared/field';
import { GoogleButtonComponent } from './google-button';
import { PileComponent } from './pile';
import { TraceryComponent } from './tracery';

export type AuthMode = 'login' | 'signup' | 'forgot' | 'sent' | 'reset';

interface Fact {
  k: string;
  v: string;
}

interface Copy {
  title: string;
  subtitle: string;
  cta: string;
  headline: [string, string];
  pitch: string;
  foot: string;
}

const EMPTY_ERRORS = { name: '', email: '', password: '' };

/** Puntos sueltos que flotan desincronizados sobre la pila. */
const DOTS = [
  { x: '16%', y: '18%', size: 8, accent: true, dur: 7, delay: 0 },
  { x: '8%', y: '58%', size: 5, accent: false, dur: 8.5, delay: 1.1 },
  { x: '38%', y: '11%', size: 6, accent: false, dur: 9, delay: 0.4 },
  { x: '73%', y: '74%', size: 10, accent: true, dur: 7.8, delay: 1.8 },
  { x: '55%', y: '88%', size: 5, accent: false, dur: 6.5, delay: 0.7 },
  { x: '90%', y: '24%', size: 6, accent: false, dur: 8.2, delay: 1.4 },
];

@Component({
  selector: 'tp-auth-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FieldComponent, GoogleButtonComponent, PileComponent, TraceryComponent],
  templateUrl: './auth-page.html',
})
export class AuthPageComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly session = inject(SessionStore);
  protected readonly authConfig = inject(AuthConfigService);

  protected readonly mode = signal<AuthMode>('login');
  protected readonly email = signal('');
  protected readonly name = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly working = signal(false);
  protected readonly localError = signal<string | null>(null);
  protected readonly resetLink = signal<string | null>(null);
  protected readonly errors = signal({ ...EMPTY_ERRORS });
  protected readonly dots = DOTS;

  private resetToken = '';

  /* ------------------------------------------------------------- reparto --- */

  /**
   * Entrar deja el formulario a la izquierda; crear y recuperar lo mandan a la
   * derecha. Los dos bloques se acercan al centro: sin eso, en una pantalla
   * ancha queda medio metro de vacio entre columnas.
   */
  protected readonly flip = computed(() => this.mode() !== 'login');

  // Las columnas cambian de celda con `order`, y la entrada la hace una
  // animación desde el lado del que vienen.
  protected readonly formCls = computed(() =>
    this.flip()
      ? 'order-2 lg:justify-start lg:pl-24 xl:pl-32 xl:pr-[7vw]'
      : 'order-1 lg:justify-end lg:pr-24 xl:pr-32 xl:pl-[7vw]',
  );

  protected readonly asideCls = computed(() =>
    this.flip() ? 'order-1 items-end pr-24 pl-12 xl:pr-32 xl:pl-[7vw]' : 'order-2 pr-12 pl-24 xl:pr-[7vw] xl:pl-32',
  );

  /* ---------------------------------------------------------------- copia --- */

  protected readonly copy = computed<Copy>(() => {
    switch (this.mode()) {
      case 'signup':
        return {
          title: 'Crea tu pila',
          subtitle: 'Te dejamos unos proyectos de ejemplo para que la veas llena de una.',
          cta: 'Crear cuenta',
          headline: ['Todo lo que empiezas,', 'en un solo sitio.'],
          pitch:
            'Anotas la idea, marcas en qué punto va y pegas el enlace cuando la publicas. Sin tableros, sin sprints, sin ceremonia.',
          foot: 'Tu cuenta vive en tu MySQL, no en la nube de nadie.',
        };
      case 'forgot':
        return {
          title: 'Recuperar acceso',
          subtitle: 'Te damos un enlace para poner una contraseña nueva.',
          cta: 'Enviar enlace',
          headline: ['Se te fue la clave,', 'no la pila.'],
          pitch: 'El enlace sirve una sola vez y caduca en 45 minutos. Tus proyectos siguen donde los dejaste.',
          foot: 'Nunca decimos si un correo está registrado o no.',
        };
      case 'sent':
        return {
          title: 'Enlace listo',
          subtitle: 'Con él pones una contraseña nueva y entras directo.',
          cta: '',
          headline: ['Se te fue la clave,', 'no la pila.'],
          pitch: 'El enlace sirve una sola vez y caduca en 45 minutos.',
          foot: 'Nunca decimos si un correo está registrado o no.',
        };
      case 'reset':
        return {
          title: 'Contraseña nueva',
          subtitle: 'Elige una y entras directo a tu lista.',
          cta: 'Guardar y entrar',
          headline: ['Una clave nueva', 'y a seguir.'],
          pitch: 'Se guarda cifrada con bcrypt. El enlace que usaste queda inservible al terminar.',
          foot: 'Cambiarla no cierra tus otras sesiones.',
        };
      default:
        return {
          title: 'Bienvenido de vuelta',
          subtitle: 'Entra para volver a tu pila de proyectos.',
          cta: 'Entrar',
          headline: ['Todo lo que estás construyendo,', 'en una sola lista.'],
          pitch:
            'Nombre, icono, stack, descripción y el enlace de lo que ya publicaste. Marcas en qué va cada uno y listo.',
          foot: 'La sesión va en una cookie del servidor: nada queda en el navegador.',
        };
    }
  });

  /** Datos reales, no adorno: es lo unico con color del bloque editorial. */
  protected readonly facts = computed<Fact[]>(() => {
    if (this.mode() === 'signup') {
      return [
        { k: 'Estados', v: '4' },
        { k: 'Ejemplos al entrar', v: '7 proyectos' },
        { k: 'Contraseña', v: 'bcrypt, 12 rondas' },
        { k: 'Almacenamiento', v: 'MySQL local' },
      ];
    }
    if (this.mode() !== 'login') {
      return [
        { k: 'Vigencia del enlace', v: '45 min' },
        { k: 'Usos', v: '1' },
        { k: 'Enlaces anteriores', v: 'anulados' },
        { k: 'Contraseña', v: 'bcrypt, 12 rondas' },
      ];
    }
    return [
      { k: 'Estados', v: 'idea → publicado' },
      { k: 'Sesión', v: 'cookie httpOnly' },
      { k: 'En el navegador', v: 'nada' },
      { k: 'Almacenamiento', v: 'MySQL local' },
    ];
  });

  protected readonly error = computed(() => this.localError() ?? this.session.error());

  /* -------------------------------------------------------------- fuerza --- */

  /** 0 corta, 1 aceptable, 2 buena. */
  protected readonly strength = computed(() => {
    const value = this.password();
    if (value.length < 8) return 0;
    const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(value)).length;
    return value.length >= 12 && variety >= 3 ? 2 : 1;
  });

  protected readonly strengthLabel = computed(() => ['Muy corta', 'Aceptable', 'Buena'][this.strength()]);
  protected readonly strengthColor = computed(() => ['var(--danger)', 'var(--accent)', 'var(--ok)'][this.strength()]);

  protected readonly canSubmit = computed(() => {
    if (this.working()) return false;
    switch (this.mode()) {
      case 'signup':
        return this.email().trim().length > 3 && this.name().trim().length > 0 && this.password().length >= 8;
      case 'forgot':
        return this.email().trim().length > 3;
      case 'reset':
        return this.password().length >= 8;
      case 'sent':
        return false;
      default:
        return this.email().trim().length > 3 && this.password().length > 0;
    }
  });

  /** El nodo encendido de la pila sube segun el momento del acceso. */
  protected readonly activeSlab = computed(() => {
    switch (this.mode()) {
      case 'signup':
        return 1;
      case 'forgot':
      case 'sent':
        return 2;
      case 'reset':
        return 5;
      default:
        return 4;
    }
  });

  /** Lo que puede salir mal al volver de Google, contado en cristiano. */
  private readonly avisosDeGoogle: Record<string, string> = {
    error: 'No se pudo completar el acceso con Google. Prueba otra vez.',
    estado: 'El acceso con Google caducó a medio camino. Empieza de nuevo.',
    'no-permitido': 'Ese correo de Google no tiene permitido abrir cuenta aquí.',
    'sin-configurar': 'Google todavía no está configurado en el servidor.',
  };

  constructor() {
    void this.authConfig.load();

    const token = this.route.snapshot.queryParamMap.get('recuperar');
    if (token) {
      this.resetToken = token;
      this.mode.set('reset');
    }

    // Al volver de Google, el motivo del fallo llega en la direccion.
    const fallo = this.route.snapshot.queryParamMap.get('google');
    if (fallo) this.localError.set(this.avisosDeGoogle[fallo] ?? this.avisosDeGoogle['error']!);
  }

  /* ------------------------------------------------------------ acciones --- */

  /** Al escribir se borra el error de ESE campo, no el de todos. */
  protected write(field: 'name' | 'email' | 'password', value: string): void {
    if (field === 'name') this.name.set(value);
    else if (field === 'email') this.email.set(value);
    else this.password.set(value);

    if (this.errors()[field]) this.errors.update((current) => ({ ...current, [field]: '' }));
    if (this.localError()) this.localError.set(null);
  }

  /** Cuenta de intercambios: sirve para no animar el primer pintado. */
  private readonly swaps = signal(0);

  /**
   * Cada columna entra desde el lado del que viene. Sin transiciones de vista:
   * capturaban la pantalla entera y dejaban el DOM congelado en la captura.
   */
  protected readonly formAnim = computed(() =>
    this.swaps() === 0 ? '' : `${this.flip() ? 'tp-from-left' : 'tp-from-right'} 540ms var(--ease-expo) both`,
  );

  protected readonly asideAnim = computed(() =>
    this.swaps() === 0 ? '' : `${this.flip() ? 'tp-from-right' : 'tp-from-left'} 540ms var(--ease-expo) both`,
  );

  protected go(next: AuthMode): void {
    if (next === this.mode()) return;
    this.session.clearError();
    this.localError.set(null);
    this.errors.set({ ...EMPTY_ERRORS });
    if (next !== 'reset') this.password.set('');

    this.mode.set(next);
    this.swaps.update((n) => n + 1);
  }

  private validate(): boolean {
    const next = { ...EMPTY_ERRORS };
    const mode = this.mode();

    if (mode === 'signup' && !this.name().trim()) next.name = 'Escribe tu nombre';
    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim())) {
      next.email = 'Ese correo no parece válido';
    }
    if (mode !== 'forgot' && mode !== 'login' && this.password().length < 8) {
      next.password = 'Al menos 8 caracteres';
    }

    this.errors.set(next);
    return !next.name && !next.email && !next.password;
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit() || !this.validate()) return;
    this.localError.set(null);
    this.working.set(true);

    try {
      switch (this.mode()) {
        case 'signup':
          if (await this.session.register(this.email().trim(), this.name().trim(), this.password())) await this.enter();
          break;
        case 'forgot': {
          const result = await this.api.forgotPassword(this.email().trim());
          this.resetLink.set(result.link ?? null);
          this.mode.set('sent');
          break;
        }
        case 'reset':
          await this.api.resetPassword(this.resetToken, this.password());
          await this.session.restore();
          await this.enter();
          break;
        default:
          if (await this.session.login(this.email().trim(), this.password())) await this.enter();
      }
    } catch (error) {
      this.localError.set(describeError(error));
    } finally {
      this.working.set(false);
    }
  }

  protected onGoogleUnavailable(message: string): void {
    this.localError.set(message);
  }

  /** Pantalla neutra hasta que la lista esté puesta: nunca las dos a la vez. */
  private async enter(): Promise<void> {
    this.password.set('');
    this.session.beginSwitch();
    try {
      await this.router.navigate(['/proyectos']);
    } finally {
      this.session.endSwitch();
    }
  }
}
