import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { MdbDropdownDirective } from 'mdb-angular-ui-kit';
import { Subscription } from 'rxjs';
import { fade } from '../../consts/animations';
import { CONFIG } from '../../consts/config';
import { toBase64 } from '../../libs/base64';
import { times } from '../../libs/math';
import { GovService } from '../../services/api/gov.service';
import { ConfigInfo } from '../../services/api/gov/config_info';
import { ExecuteMsg } from '../../services/api/gov/polls_response';
import { TokenService } from '../../services/api/token.service';
import { TerrajsService } from '../../services/terrajs.service';
import {GoogleAnalyticsService} from 'ngx-google-analytics';

@Component({
  selector: 'app-gov-poll-new',
  templateUrl: './gov-poll-new.component.html',
  styleUrls: ['./gov-poll-new.component.scss'],
  animations: [fade]
})
export class GovPollNewComponent implements OnInit, OnDestroy {

  title: string;
  description: string;
  link: string;
  executeMsgs: ExecuteMsg[] = [];
  amount: number;
  connected: Subscription;
  maxAmount = 0;
  config: ConfigInfo;

  @ViewChild('form') form: NgForm;
  @ViewChild('dropdown') dropdown: MdbDropdownDirective;

  constructor(
    private gov: GovService,
    private router: Router,
    private terrajs: TerrajsService,
    private token: TokenService,
    protected $gaService: GoogleAnalyticsService
  ) { }

  ngOnInit(): void {
    this.connected = this.terrajs.connected
      .subscribe(connected => {
        this.gov.config()
          .then(config => {
            this.config = config;
            this.amount = +config.proposal_deposit / CONFIG.UNIT;
          });

        if (connected) {
          this.token.balance(this.terrajs.settings.specToken)
            .then(it => this.maxAmount = +it.balance / CONFIG.UNIT);
        }

      });
  }

  ngOnDestroy(): void {
    this.connected.unsubscribe();
  }

  formatJson(i: number) {
    const msg = this.executeMsgs[i]?.execute.msg;
    if (!msg) {
      return;
    }

    try {
      const obj = JSON.parse(msg);
      this.executeMsgs[i].msg = JSON.stringify(obj, undefined, 2);
    } catch (e) { }
  }

  async submit() {
    if (this.form.invalid) {
      return;
    }
    this.$gaService.event('CLICK_SUBMIT_GOV_POLL');
    await this.token.handle(this.terrajs.settings.specToken, {
      send: {
        amount: times(this.amount, CONFIG.UNIT),
        contract: this.terrajs.settings.gov,
        msg: toBase64({
          poll_start: {
            title: this.title,
            description: this.description,
            link: this.link,
            execute_msgs: this.executeMsgs.map(it => ({
              execute: {
                contract: it.execute.contract,
                msg: JSON.stringify(JSON.parse(it.execute.msg)),
              }
            })),
          }
        })
      }
    });

    this.router.navigateByUrl('/gov');
  }

  pushMsg(type: string) {
    const getMsg = ($type: string) => {
      switch ($type) {
        case 'govConfig':
          const { spec_token, ...config } = this.config;
          return {
            execute: {
              contract: this.terrajs.settings.gov,
              msg: JSON.stringify({ update_config: config }, undefined, 2),
            }
          };
        case 'govVault':
          return {
            execute: {
              contract: this.terrajs.settings.gov,
              msg: JSON.stringify({
                upsert_vault: {
                  vault_address: '',
                  weight: 0,
                }
              }, undefined, 2)
            }
          };
        case 'poolAdd':
          return {
            execute: {
              contract: this.terrajs.settings.mirrorFarm,
              msg: JSON.stringify({
                register_asset: {
                  asset_token: '',
                  staking_token: '',
                  weight: 0,
                  auto_compound: false,
                }
              }, undefined, 2)
            }
          };
        default:
          return {
            execute: { contract: '', msg: '' }
          };
      }
    };
    this.executeMsgs.push(getMsg(type));
    this.dropdown.hide();
  }
}
