import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';
import { LoggerService } from '../../domain/services/logging.service';

@Injectable()
export class ExceptionInterceptor implements NestInterceptor {
  private log: LoggerService = new LoggerService('App');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        this.log.err(error.response, { module: 'Intercept', action: 'Error handling' });
        return throwError(
          () => new HttpException(error.response, 500),
        );
      }),
    );
  }
}
