import { Gateway } from '../../../../../../../src/declarations';
import { Rooms } from '../../application/ports/rooms.port';

@Gateway(Rooms, { replaces: true })
export class AlwaysFreeRooms implements Rooms {
  async isFree(): Promise<boolean> {
    return true;
  }
}
