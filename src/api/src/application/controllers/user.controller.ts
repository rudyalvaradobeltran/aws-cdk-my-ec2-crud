import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class UserController {

  @Get('/user')
  async get(@Res() res: Response) {
    res.status(HttpStatus.OK).json({ message: "Hello" });
  }
}