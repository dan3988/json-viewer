import { Component, Input, OnInit } from '@angular/core';
import { JsonProperty } from '../json';

@Component({
	selector: 'app-json-property',
	templateUrl: './json-property.component.html',
	styleUrls: ['./json-property.component.scss']
})
export class JsonPropertyComponent implements OnInit {
	@Input()
	public prop: undefined | JsonProperty;

	constructor() {
		
	}

	ngOnInit(): void {
	}
}
