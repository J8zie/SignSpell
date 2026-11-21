import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ThemeService } from '../../core/theme.service';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Magnetic } from '../../shared/magnetic';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [Magnetic, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  readonly open = signal(false);
  readonly links = [
    { href: '#journey', label: 'How it works' },
    { href: '#modes', label: 'Practice modes' },
    { href: '#guide', label: 'Letter guide' },
    { href: '#team', label: 'Team' },
  ];
}
