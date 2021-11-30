import { Injectable } from '@angular/core';
import { ModalComponent } from './modal/modal.component';
import {MdbModalService} from 'mdb-angular-ui-kit/modal';

export type IconType = 'info' | 'warning' | 'danger' | 'question' | 'success';

export interface IModalOptions {
  title?: string;
  okText?: string;
  cancelText?: string;
  iconType?: IconType;
  icon?: string;
  iconClass?: string;
}

export interface NotifyItem {
  message?: string;
  link?: string;
  linkText?: string;
  iconType?: IconType;
  icon?: string;
  iconClass?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  notifyItems: NotifyItem[] = [];

  constructor(
    private modalService: MdbModalService,
  ) { }

  private translateIcon(iconType: IconType) {
    switch (iconType) {
      case 'info':
        return { icon: 'fa-info-circle', iconClass: 'text-info' };
      case 'success':
        return { icon: 'fa-check', iconClass: 'text-success' };
      case 'question':
        return { icon: 'fa-question-circle', iconClass: 'text-info' };
      case 'warning':
        return { icon: 'fa-exclamation-triangle', iconClass: 'text-warning' };
      case 'danger':
        return { icon: 'fa-times-circle', iconClass: 'text-danger' };
    }
  }

  alert(message: string, opts?: IModalOptions): Promise<void> {
    const ref = this.modalService.open(ModalComponent, {
      keyboard: false,
      ignoreBackdropClick: true,
      data: {
        message,
        cancelText: '',
        ...opts,
        ...this.translateIcon(opts?.iconType || 'info'),
      }
    });
    return ref.onClose.toPromise();
  }

  confirm(message: string, opts?: IModalOptions): Promise<boolean> {
    const ref = this.modalService.open(ModalComponent, {
      keyboard: false,
      ignoreBackdropClick: true,
      data: {
        message,
        ...opts,
        ...this.translateIcon(opts?.iconType || 'question'),
      }
    });
    return ref.onClose.toPromise();
  }
  notify(message: string, opts?: NotifyItem) {
    const iconType = opts?.iconType || 'info';
    const item = {
      message,
      ...opts,
      iconType,
      ...this.translateIcon(iconType),
    };
    this.notifyItems.push(item);

    setTimeout(() => {
      const i = this.notifyItems.findIndex(it => it === item);
      if (i >= 0) {
        this.notifyItems.splice(i, 1);
      }
    }, 10000);
  }
}
