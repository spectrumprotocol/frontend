import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoaderService } from './loader.service';

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
  constructor(
    private loader: LoaderService,
  ) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (req.headers.get('Ignore-Loading') === 'true') {
      return next.handle(req.clone({ headers: req.headers.delete('Ignore-Loading') }));
    }

    this.loader.enterLoad();
    return next.handle(req).pipe(
      finalize(() => this.loader.exitLoad())
    );
  }
}
