import { Injectable, inject } from '@angular/core';
import { collection, getDocs } from 'firebase/firestore/lite';
import { paths } from '../firebase/paths';
import { CacheLocal } from '../cache/cache-local';
import { FirebaseService } from '../firebase/firebase.service';
import type { ConnectionDoc } from './models';

/** Conexões Open Finance. Só leitura: quem grava é a sincronização (tools/pluggy-sync). */
@Injectable({ providedIn: 'root' })
export class ConnectionsRepository {
  private readonly db = inject(FirebaseService).db;
  private readonly cache = inject(CacheLocal);

  list(uid: string): Promise<ConnectionDoc[]> {
    return this.cache.ler(`${uid}|connections`, () => this.listDoServidor(uid));
  }

  private async listDoServidor(uid: string): Promise<ConnectionDoc[]> {
    const snap = await getDocs(collection(this.db, paths.connections(uid)));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<ConnectionDoc, 'id'>),
    }));
  }
}
