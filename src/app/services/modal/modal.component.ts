import { Component } from '@angular/core';
import {MdbModalRef} from 'mdb-angular-ui-kit/modal';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss']
})
export class ModalComponent {
  title?: string;
  icon?: string;
  iconClass?: string;
  message: string;
  okText = 'Ok';
  cancelText = 'Cancel';

  constructor(
    private modalRef: MdbModalRef<ModalComponent>
  ) { }

  ok() {
    this.modalRef.close(true);
  }

  cancel() {
    this.modalRef.close(false);
  }

}
