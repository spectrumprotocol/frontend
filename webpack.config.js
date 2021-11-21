const webpack = require('webpack');

module.exports = {
  //...
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser',
    })
  ],

  devServer: {
    proxy: {
      '/lcd': {
         target: {
            host: "3.34.120.243",
            protocol: 'http:',
            port: 1317
         },
         pathRewrite: {
            '^/lcd': ''
         }
      }
   }
  }
  //...
}
