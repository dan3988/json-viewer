import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JsonContainerComponent } from './json-container.component';

describe('JsonContainerComponent', () => {
  let component: JsonContainerComponent;
  let fixture: ComponentFixture<JsonContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ JsonContainerComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JsonContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
