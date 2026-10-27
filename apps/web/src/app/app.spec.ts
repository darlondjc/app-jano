import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@jano/data-access';
import { App } from './app';

describe('App', () => {
  beforeEach(() => sessionStorage.setItem('jano.splash.vista', '1'));

  it('cria o shell com router-outlet e sem splash se já vista', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { whenReady: async () => undefined },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('jano-splash')).toBeNull();
  });
});
