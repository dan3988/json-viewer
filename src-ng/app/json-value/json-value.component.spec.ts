import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JsonValueComponent } from './json-value.component';

describe('JsonValueComponent', () => {
  let component: JsonValueComponent;
  let fixture: ComponentFixture<JsonValueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ JsonValueComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JsonValueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
