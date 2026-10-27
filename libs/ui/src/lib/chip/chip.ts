import { ChangeDetectionStrategy, Component, model } from '@angular/core';

/** Chip de filtro alternável. Uso: <jano-chip [(pressed)]="ativo">Cartão</jano-chip> */
@Component({
  selector: 'jano-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="j-chip"
      [attr.aria-pressed]="pressed()"
      (click)="pressed.set(!pressed())"
    >
      <ng-content />
    </button>
  `,
})
export class JanoChip {
  readonly pressed = model(false);
}
