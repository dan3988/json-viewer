import { Component, Input, OnInit } from '@angular/core';
import { JsonValue } from '../json';

@Component({
	selector: 'app-json-value',
	templateUrl: './json-value.component.html',
	styleUrls: ['./json-value.component.scss']
})
export class JsonValueComponent implements OnInit {
	@Input()
	public token: undefined | JsonValue;

	constructor() {
		
	}

	ngOnInit(): void {
	}
}
