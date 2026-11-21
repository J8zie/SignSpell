import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Magnetic } from '../../shared/magnetic';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [Magnetic, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  readonly team = ['Jay Ampong', 'Jellian Jade I. Lobo', 'Louelyn Españo', 'Joriel Anne Igagamao', 'Khegie Cervantes'];
  readonly year = new Date().getFullYear();
}
