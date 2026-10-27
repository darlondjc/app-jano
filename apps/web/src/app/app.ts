import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'jano-root',
  template: '<router-outlet />',
})
export class App {}
