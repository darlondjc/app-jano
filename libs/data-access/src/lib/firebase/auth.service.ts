import { Injectable, computed, inject, signal } from '@angular/core';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { FirebaseService } from './firebase.service';

export type AuthState = 'carregando' | 'deslogado' | 'logado';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(FirebaseService).auth;
  private readonly _user = signal<User | null>(null);
  private readonly _ready = signal(false);

  readonly user = this._user.asReadonly();
  readonly state = computed<AuthState>(() =>
    !this._ready() ? 'carregando' : this._user() ? 'logado' : 'deslogado',
  );

  constructor() {
    onAuthStateChanged(this.auth, (u) => {
      this._user.set(u);
      this._ready.set(true);
    });
  }

  /** Resolve quando o Firebase restaurou (ou não) a sessão. */
  async whenReady(): Promise<void> {
    while (!this._ready()) await new Promise((r) => setTimeout(r, 25));
  }

  async signInWithGoogle(): Promise<void> {
    await signInWithPopup(this.auth, new GoogleAuthProvider());
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }
}
