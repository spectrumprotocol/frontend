import { Component } from '@angular/core';
import {MdbModalRef} from 'mdb-angular-ui-kit/modal';

@Component({
  selector: 'app-connect-options',
  templateUrl: './connect-options.component.html',
  styleUrls: ['./connect-options.component.scss']
})
export class ConnectOptionsComponent {
  types: string[];

  constructor(
    private modalRef: MdbModalRef<ConnectOptionsComponent>
  ) { }

  connect(type: string) {
    this.modalRef.close(type);
  }

}
