import { Component, Input, OnInit } from '@angular/core';
import { JsonContainer } from '../json';

@Component({
	selector: 'app-json-container',
	templateUrl: './json-container.component.html',
	styleUrls: ['./json-container.component.scss']
})
export class JsonContainerComponent implements OnInit {
	@Input()
	public container: undefined | JsonContainer;

	constructor() { }

	ngOnInit(): void {
	}
}
