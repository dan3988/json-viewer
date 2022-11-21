import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { JsonValueComponent } from './json-value/json-value.component';
import { JsonContainerComponent } from './json-container/json-container.component';
import { JsonPropertyComponent } from './json-property/json-property.component';

@NgModule({
  declarations: [
    AppComponent,
    JsonValueComponent,
    JsonContainerComponent,
    JsonPropertyComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
