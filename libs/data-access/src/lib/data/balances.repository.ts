import { Injectable, inject } from '@angular/core';
import { collection, getDocs } from 'firebase/firestore/lite';
import { paths } from '../firebase/paths';
import { FirebaseService } from '../firebase/firebase.service';
import type { BalanceDoc } from './models';

/** Saldos no banco. Só leitura: quem grava é a sincronização Open Finance. */
@Injectable({ providedIn: 'root' })
export class BalancesRepository {
  private readonly db = inject(FirebaseService).db;

  async list(uid: string): Promise<BalanceDoc[]> {
    const snap = await getDocs(collection(this.db, paths.balances(uid)));
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<BalanceDoc, 'id'>),
    }));
  }
}
