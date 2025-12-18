import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Macros } from './macros';

describe('Macros', () => {
  let component: Macros;
  let fixture: ComponentFixture<Macros>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Macros]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Macros);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
