import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GeofencesModule } from '../geofences/geofences.module';

import { PortsService } from './ports/ports.service';
import { PortsController } from './ports/ports.controller';

import { VesselsService } from './vessels/vessels.service';
import { VesselsController } from './vessels/vessels.controller';

import { SeaCrewService } from './crew/sea-crew.service';
import { SeaCrewController } from './crew/sea-crew.controller';

import { VoyagesService } from './voyages/voyages.service';
import { VoyagesController } from './voyages/voyages.controller';

import { SeaRoutingService } from './routing/sea-routing.service';
import { VoyageSimulationService } from './movements/voyage-simulation.service';
import { VoyageMovementsService } from './movements/voyage-movements.service';
import { VoyageMovementsController } from './movements/voyage-movements.controller';

import { SeaConvoysService } from './convoys/sea-convoys.service';
import { SeaConvoysController } from './convoys/sea-convoys.controller';

import { SeaCarbonService } from './intelligence/sea-carbon.service';
import { SeaCrewScoringService } from './intelligence/sea-crew-scoring.service';
import { WatchkeepingService } from './intelligence/watchkeeping.service';
import { SeaEtaService } from './intelligence/sea-eta.service';
import { PortSlotService } from './intelligence/port-slot.service';
import { SeawaysPdfReportService } from './reports/seaways-pdf-report.service';

@Module({
  imports: [
    SupabaseModule,
    GeocodingModule,
    RealtimeModule,
    NotificationsModule,
    GeofencesModule,
  ],
  controllers: [
    PortsController,
    VesselsController,
    SeaCrewController,
    VoyagesController,
    VoyageMovementsController,
    SeaConvoysController,
  ],
  providers: [
    PortsService,
    VesselsService,
    SeaCrewService,
    VoyagesService,
    SeaRoutingService,
    VoyageSimulationService,
    VoyageMovementsService,
    SeaConvoysService,
    SeaCarbonService,
    SeaCrewScoringService,
    WatchkeepingService,
    SeaEtaService,
    PortSlotService,
    SeawaysPdfReportService,
  ],
  exports: [
    PortsService,
    VesselsService,
    SeaCrewService,
    VoyagesService,
    SeaRoutingService,
    VoyageSimulationService,
    VoyageMovementsService,
    SeaConvoysService,
    SeaCarbonService,
    SeaCrewScoringService,
    WatchkeepingService,
    SeaEtaService,
    PortSlotService,
    SeawaysPdfReportService,
  ],
})
export class SeawaysModule {}
