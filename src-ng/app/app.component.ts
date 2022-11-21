import { Component, HostListener, Input, OnInit } from '@angular/core';
import { JsonProperty, JsonToken } from './json';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
	@Input()
	public root: undefined | JsonToken;

	title = 'src-ng';

	ngOnInit(): void {
		const pre = document.body.querySelector(":scope > pre") as HTMLPreElement;
		const data = pre.innerText;
		pre.remove();
		const json = JSON.parse(data);
		this.root = JsonToken.create(json);
	}
}
