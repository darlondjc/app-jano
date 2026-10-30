import { Injectable, inject } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore/lite';
import { FIREBASE_CONFIG } from './firebase.config';

/** Ponto único de inicialização do Firebase. */
@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private readonly app = initializeApp(inject(FIREBASE_CONFIG));
  readonly auth = getAuth(this.app);
  readonly db = getFirestore(this.app);
}
