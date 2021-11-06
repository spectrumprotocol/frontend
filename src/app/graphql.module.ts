import { NgModule } from '@angular/core';
import { APOLLO_NAMED_OPTIONS } from 'apollo-angular';
import { ApolloClientOptions, InMemoryCache } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';

export function createApollo(httpLink: HttpLink): Record<string, ApolloClientOptions<any>> {
  return {
    mirror: {
      link: httpLink.create({ uri: 'https://graph.mirror.finance/graphql' }),
      cache: new InMemoryCache(),
    },
    mirrorTest: {
      link: httpLink.create({ uri: 'https://bombay-graph.mirror.finance/graphql' }),
      cache: new InMemoryCache(),
    },
    anchor: {
      link: httpLink.create({ uri: 'https://mantle.anchorprotocol.com/graphql' }),
      cache: new InMemoryCache(),
    },
    anchorTest: {
      link: httpLink.create({ uri: 'https://bombay-mantle.anchorprotocol.com/graphql' }),
      cache: new InMemoryCache(),
    },
    nexus: {
      link: httpLink.create({ uri: 'https://api.nexusprotocol.app/graphql' }),
      cache: new InMemoryCache(),
    },
  };
}

@NgModule({
  providers: [
    {
      provide: APOLLO_NAMED_OPTIONS,
      useFactory: createApollo,
      deps: [HttpLink],
    },
  ],
})
export class GraphQLModule { }
