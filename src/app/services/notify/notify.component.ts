import { Component } from '@angular/core';
import { fade } from '../../consts/animations';
import { ModalService } from '../modal.service';

@Component({
  selector: 'app-notify',
  templateUrl: './notify.component.html',
  styleUrls: ['./notify.component.scss'],
  animations: [fade]
})
export class NotifyComponent {

  constructor(
    public modal: ModalService,
  ) { }

  dismiss(i: number) {
    this.modal.notifyItems.splice(i, 1);
  }
}
