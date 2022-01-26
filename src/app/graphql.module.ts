import { NgModule } from '@angular/core';
import { APOLLO_NAMED_OPTIONS } from 'apollo-angular';
import { ApolloClientOptions, DefaultOptions, InMemoryCache } from '@apollo/client/core';
import { HttpLink } from 'apollo-angular/http';

const defaultOptions: DefaultOptions = {
  watchQuery: {
    fetchPolicy: 'cache-and-network',
  },
  query: {
    fetchPolicy: 'no-cache',
  },
};

export function createApollo(httpLink: HttpLink): Record<string, ApolloClientOptions<any>> {
  return {
    mirror: {
      link: httpLink.create({ uri: 'https://graph.mirror.finance/graphql' }),
      cache: new InMemoryCache(),
      defaultOptions,
    },
    mirrorTest: {
      link: httpLink.create({ uri: 'https://graph.mirror.finance/graphql' }), // bombay graph is down
      cache: new InMemoryCache(),
      defaultOptions,
    },
    anchor: {
      link: httpLink.create({ uri: 'https://mantle.anchorprotocol.com/graphql' }),
      cache: new InMemoryCache(),
      defaultOptions,
    },
    anchorTest: {
      link: httpLink.create({ uri: 'https://bombay-mantle.anchorprotocol.com/graphql' }),
      cache: new InMemoryCache(),
      defaultOptions,
    },
    nexus: {
      link: httpLink.create({ uri: 'https://api.nexusprotocol.app/graphql' }),
      cache: new InMemoryCache(),
      defaultOptions,
    },
    astroport: {
      link: httpLink.create({ uri: 'https://api.astroport.fi/graphql' }),
      cache: new InMemoryCache(),
      defaultOptions,
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
